import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

// The deck deadline scales with the deck: healthy moderation takes ~0.25 s
// per card, so 1 s per card is a 4x margin, and 5 s covers the first
// round trip. A fixed budget would cap deck size instead of catching a
// slow gateway. 240 s stays under nginx's 300 s API timeout.
const MODERATION_BASE_DEADLINE_MS = 5_000;
const MODERATION_PER_CARD_MS = 1_000;
const MODERATION_MAX_DEADLINE_MS = 240_000;
// Cap one stalled card at 30 s, well below nginx's 300 s API timeout.
const MODERATION_CARD_TIMEOUT_MS = 30_000;

export function moderationDeadlineMs(cardCount: number): number {
  return Math.min(
    MODERATION_BASE_DEADLINE_MS + MODERATION_PER_CARD_MS * cardCount,
    MODERATION_MAX_DEADLINE_MS,
  );
}

export interface ModerationVerdict {
  ok: boolean;
  /** Why the deck was refused when no individual card was flagged. */
  reason?: string;
  flagged: { cardId: string; reason: string; classifier?: string }[];
  warnings: { cardId: string; reason: string; classifier?: string }[];
  results: ModerationClassifierResult[];
}

export interface ModerationClassifierResult {
  cardId: string;
  classifier: string;
  verdict: ModerationGrade | 'error';
  /** null means this classifier does not supply a category taxonomy. */
  categories: string[] | null;
  error?: string;
}

export interface ModerationInput {
  deckId: string;
  cards: { id: string; front: string; back: string }[];
}

export type ModerationGrade = 'safe' | 'unsafe' | 'controversial';
type ModerationOutputFormat =
  'qwen3guard' | 'shieldgemma' | 'llama-guard' | 'granite-guardian';

interface Classifier {
  model: string;
  format: ModerationOutputFormat;
}

const FAST_CLASSIFIER: Classifier = {
  model: 'moderation',
  format: 'qwen3guard',
};

// This alias is backed by ShieldGemma in the checked-in LiteLLM config. Keep
// the alias and parser contract in lockstep if round two selects a replacement.
const THOROUGH_CLASSIFIER: Classifier = {
  model: 'moderation-thorough',
  format: 'shieldgemma',
};

export function parseModerationOutput(
  format: ModerationOutputFormat,
  content: string,
): { grade: ModerationGrade; categories: string[] | null } | null {
  if (format === 'qwen3guard') {
    const match = content.match(
      /Safety:\s*(Safe|Unsafe|Controversial)\b(?:[\s\S]*?Categories:\s*([^\n]*))?/i,
    );
    if (!match) return null;
    const grade = match[1].toLowerCase() as ModerationGrade;
    const categories = (match[2] ?? '')
      .split(/[,;]/)
      .map((category) => category.trim())
      .filter(
        (category) => category.length > 0 && category.toLowerCase() !== 'none',
      );
    return {
      grade,
      categories,
    };
  }

  if (format === 'shieldgemma') {
    const match = content.trim().match(/^(yes|no)\.?$/i);
    if (!match) return null;
    return match[1].toLowerCase() === 'yes'
      ? { grade: 'unsafe', categories: null }
      : { grade: 'safe', categories: null };
  }

  if (format === 'llama-guard') {
    const match = content.trim().match(/^(safe|unsafe)(?:\s+([^\n]+))?/i);
    if (!match) return null;
    const grade = match[1].toLowerCase() as 'safe' | 'unsafe';
    return {
      grade,
      categories: match[2]?.trim() ? [match[2].trim()] : [],
    };
  }

  const match = content.match(/<score>\s*(yes|no)\s*<\/score>/i);
  if (!match) return null;
  return match[1].toLowerCase() === 'yes'
    ? { grade: 'unsafe', categories: null }
    : { grade: 'safe', categories: null };
}

function findingReason(result: ModerationClassifierResult): string {
  if (result.categories?.length) return result.categories.join(', ');
  return result.verdict[0].toUpperCase() + result.verdict.slice(1);
}

function moderationErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Moderation deadline exceeded')
      return 'deadline_exceeded';
    if (error.message === 'Moderation gateway error') return 'gateway_error';
    if (error.message === 'Unparseable moderation verdict')
      return 'unparseable';
  }
  const name =
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
      ? error.name
      : '';
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout';
  return 'request_error';
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly config: ConfigService) {}

  async check(input: ModerationInput): Promise<ModerationVerdict> {
    return this.checkWithModels(input, [FAST_CLASSIFIER], false);
  }

  /**
   * A report is stronger evidence than a normal publish attempt. Re-check the
   * immutable public snapshot with the fast gate and an independently
   * configured second classifier. The alias and its native response parser
   * form one versioned contract and must change together after benchmarking.
   */
  async checkThorough(input: ModerationInput): Promise<ModerationVerdict> {
    return this.checkWithModels(
      input,
      [FAST_CLASSIFIER, THOROUGH_CLASSIFIER],
      true,
    );
  }

  private async checkWithModels(
    input: ModerationInput,
    classifiers: Classifier[],
    identifyClassifier: boolean,
  ): Promise<ModerationVerdict> {
    if (this.config.get('MODERATION_ALLOW_ALL') === '1') {
      return { ok: true, flagged: [], warnings: [], results: [] };
    }

    const apiBase = this.config.get<string>('AI_API_BASE')?.replace(/\/+$/, '');
    const apiKey = this.config.get<string>('AI_API_KEY') ?? '';
    const unavailable = (
      results: ModerationClassifierResult[],
    ): ModerationVerdict => ({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
      results,
    });
    if (!apiBase) {
      return unavailable(
        classifiers.flatMap((classifier) =>
          input.cards.map((card) => ({
            cardId: card.id,
            classifier: classifier.model,
            verdict: 'error' as const,
            categories: null,
            error: 'gateway_unconfigured',
          })),
        ),
      );
    }

    const flagged: ModerationVerdict['flagged'] = [];
    const warnings: ModerationVerdict['warnings'] = [];
    const results: ModerationClassifierResult[] = [];
    const startedAt = Date.now();
    const failures: string[] = [];
    for (const classifier of classifiers) {
      // Each required classifier gets an independent budget. A hung fast gate
      // must not consume the thorough classifier's opportunity to decide.
      const deadline = Date.now() + moderationDeadlineMs(input.cards.length);
      for (const card of input.cards) {
        try {
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error('Moderation deadline exceeded');

          const response = await fetch(`${apiBase}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: classifier.model,
              temperature: 0,
              stream: false,
              messages: [
                { role: 'user', content: `${card.front}\n${card.back}` },
              ],
            }),
            signal: AbortSignal.timeout(
              Math.min(MODERATION_CARD_TIMEOUT_MS, remaining),
            ),
          });
          if (!response.ok) throw new Error('Moderation gateway error');

          const data = (await response.json()) as ChatCompletionResponse;
          const content = data.choices?.[0]?.message?.content ?? '';
          const parsed = parseModerationOutput(classifier.format, content);
          if (!parsed) throw new Error('Unparseable moderation verdict');

          const result: ModerationClassifierResult = {
            cardId: card.id,
            classifier: classifier.model,
            verdict: parsed.grade,
            categories: parsed.categories,
          };
          results.push(result);
          const finding = {
            cardId: card.id,
            reason: findingReason(result),
            ...(identifyClassifier ? { classifier: classifier.model } : {}),
          };
          if (parsed.grade === 'unsafe') flagged.push(finding);
          if (parsed.grade === 'controversial') warnings.push(finding);
        } catch (error: unknown) {
          const code = moderationErrorCode(error);
          failures.push(`${classifier.model}:${card.id}:${code}`);
          results.push({
            cardId: card.id,
            classifier: classifier.model,
            verdict: 'error',
            categories: null,
            error: code,
          });
        }
      }
    }

    if (failures.length > 0) {
      this.logger.warn(
        `Moderation had ${failures.length} failed request(s) for deck ${input.deckId} after ${Date.now() - startedAt}ms: ${failures.join(', ')}`,
      );
      // Any Unsafe opinion is sufficient evidence to block. Otherwise every
      // required request must complete before a clean result can be trusted.
      if (flagged.length === 0) {
        return {
          ...unavailable(results),
          warnings,
        };
      }
    }

    return { ok: flagged.length === 0, flagged, warnings, results };
  }
}
