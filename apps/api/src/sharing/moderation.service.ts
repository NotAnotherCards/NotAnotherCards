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
}

export interface ModerationInput {
  deckId: string;
  cards: { id: string; front: string; back: string }[];
}

type ModerationGrade = 'safe' | 'unsafe' | 'controversial';
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
): { grade: ModerationGrade; reason: string } | null {
  if (format === 'qwen3guard') {
    const match = content.match(
      /Safety:\s*(Safe|Unsafe|Controversial)\b(?:[\s\S]*?Categories:\s*([^\n]*))?/i,
    );
    if (!match) return null;
    const grade = match[1].toLowerCase() as ModerationGrade;
    const category = match[2]?.trim();
    return {
      grade,
      reason:
        category && category.toLowerCase() !== 'none' ? category : match[1],
    };
  }

  if (format === 'shieldgemma') {
    const match = content.trim().match(/^(yes|no)\.?$/i);
    if (!match) return null;
    return match[1].toLowerCase() === 'yes'
      ? { grade: 'unsafe', reason: 'Unsafe' }
      : { grade: 'safe', reason: 'Safe' };
  }

  if (format === 'llama-guard') {
    const match = content.trim().match(/^(safe|unsafe)(?:\s+([^\n]+))?/i);
    if (!match) return null;
    const grade = match[1].toLowerCase() as 'safe' | 'unsafe';
    return { grade, reason: match[2]?.trim() || match[1] };
  }

  const match = content.match(/<score>\s*(yes|no)\s*<\/score>/i);
  if (!match) return null;
  return match[1].toLowerCase() === 'yes'
    ? { grade: 'unsafe', reason: 'Unsafe' }
    : { grade: 'safe', reason: 'Safe' };
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
      return { ok: true, flagged: [], warnings: [] };
    }

    const apiBase = this.config.get<string>('AI_API_BASE')?.replace(/\/+$/, '');
    const apiKey = this.config.get<string>('AI_API_KEY') ?? '';
    const unavailable = (): ModerationVerdict => ({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
    if (!apiBase) return unavailable();

    const flagged: ModerationVerdict['flagged'] = [];
    const warnings: ModerationVerdict['warnings'] = [];
    const startedAt = Date.now();
    const deadline =
      startedAt + moderationDeadlineMs(input.cards.length * classifiers.length);
    try {
      for (const classifier of classifiers) {
        for (const card of input.cards) {
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

          const finding = {
            cardId: card.id,
            reason: parsed.reason,
            ...(identifyClassifier ? { classifier: classifier.model } : {}),
          };
          if (parsed.grade === 'unsafe') flagged.push(finding);
          if (parsed.grade === 'controversial') warnings.push(finding);
        }
      }
    } catch (error: unknown) {
      const name =
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        typeof error.name === 'string'
          ? error.name
          : 'UnknownError';
      this.logger.warn(
        `Moderation failed for deck ${input.deckId} after ${Date.now() - startedAt}ms: ${name}`,
      );
      // An already returned Unsafe verdict is sufficient to block. Do not
      // erase that evidence merely because a later card or classifier failed.
      if (flagged.length > 0) return { ok: false, flagged, warnings };
      return unavailable();
    }

    return { ok: flagged.length === 0, flagged, warnings };
  }
}
