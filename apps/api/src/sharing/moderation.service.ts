import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  isShortText,
  moderationTexts,
  type ModerationNote,
} from './moderation-context';
import judgePolicy from './moderation-judge-policy.json';

const judgeVerdict = z.strictObject({
  verdict: z.enum(['confirm', 'warn']),
  reason: z.string().trim().min(1).max(500),
});

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

  async check(input: {
    deckId: string;
    notes: ModerationNote[];
  }): Promise<ModerationVerdict> {
    if (input.notes.some((note) => note.cardIds.length === 0)) {
      return {
        ok: false,
        reason: 'a note has no cards',
        flagged: [],
        warnings: [],
        results: [],
      };
    }
    const items = moderationTexts(input.notes);
    const configuredPool = Number(
      this.config.get('MODERATION_CONCURRENCY') ?? 8,
    );
    const pool =
      Number.isInteger(configuredPool) &&
      configuredPool >= 1 &&
      configuredPool <= 8
        ? configuredPool
        : 8;
    const verdict = await this.checkWithModels(
      {
        deckId: input.deckId,
        items,
      },
      [FAST_CLASSIFIER],
      false,
      true,
      pool,
    );
    const cardsByText = new Map(items.map((item) => [item.id, item.cardIds]));
    const expand = <T extends { cardId: string }>(rows: T[]): T[] =>
      rows.flatMap((row) =>
        (cardsByText.get(row.cardId) ?? []).map((cardId) => ({
          ...row,
          cardId,
        })),
      );
    return {
      ...verdict,
      flagged: expand(verdict.flagged),
      warnings: expand(verdict.warnings),
      results: expand(verdict.results),
    };
  }

  /**
   * A report is stronger evidence than a normal publish attempt. Re-check the
   * immutable public snapshot with the fast gate and an independently
   * configured second classifier. The alias and its native response parser
   * form one versioned contract and must change together after benchmarking.
   */
  async checkThorough(input: ModerationInput): Promise<ModerationVerdict> {
    return this.checkWithModels(
      {
        deckId: input.deckId,
        items: input.cards.map((card) => ({
          id: card.id,
          text: `${card.front}\n${card.back}`,
        })),
      },
      [FAST_CLASSIFIER, THOROUGH_CLASSIFIER],
      true,
    );
  }

  private async checkWithModels(
    input: {
      deckId: string;
      items: { id: string; text: string; contexts?: string[] }[];
    },
    classifiers: Classifier[],
    identifyClassifier: boolean,
    judgeFlagged = false,
    concurrency = 1,
  ): Promise<ModerationVerdict> {
    if (this.config.get('MODERATION_ALLOW_ALL') === '1') {
      return { ok: true, flagged: [], warnings: [], results: [] };
    }

    const apiBase = this.config.get<string>('AI_API_BASE')?.replace(/\/+$/, '');
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
          input.items.map((card) => ({
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
      const deadline = Date.now() + moderationDeadlineMs(input.items.length);
      const checkItem = async (index: number) => {
        const card = input.items[index];
        const flagged: ModerationVerdict['flagged'] = [];
        const warnings: ModerationVerdict['warnings'] = [];
        const results: ModerationClassifierResult[] = [];
        try {
          const content = await this.complete(
            {
              model: classifier.model,
              temperature: 0,
              stream: false,
              messages: [{ role: 'user', content: card.text }],
            },
            deadline,
          );
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
          if (parsed.grade === 'unsafe') {
            // A judge error must retain the known refusal, not erase it.
            let warning: string | undefined;
            if (judgeFlagged && isShortText(card.text)) {
              const model =
                this.config.get<string>('AI_DEFAULT_MODEL') ?? 'gemma4';
              try {
                for (const context of card.contexts ?? ['{}']) {
                  const opinion = await this.judge(
                    card.text,
                    finding.reason,
                    deadline,
                    context,
                  );
                  results.push({
                    cardId: card.id,
                    classifier: model,
                    verdict: opinion ? 'controversial' : 'unsafe',
                    categories: null,
                  });
                  if (!opinion) {
                    warning = undefined;
                    break;
                  }
                  warning = opinion;
                }
              } catch (error) {
                warning = undefined;
                results.push({
                  cardId: card.id,
                  classifier: model,
                  verdict: 'error',
                  categories: null,
                  error: moderationErrorCode(error),
                });
              }
            }
            if (warning) warnings.push({ ...finding, reason: warning });
            else flagged.push(finding);
          }
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
        return { flagged, warnings, results };
      };
      const outcomes: Awaited<ReturnType<typeof checkItem>>[] = [];
      let next = 0;
      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, input.items.length) },
          async () => {
            while (next < input.items.length) {
              const index = next++;
              outcomes[index] = await checkItem(index);
            }
          },
        ),
      );
      for (const outcome of outcomes) {
        flagged.push(...outcome.flagged);
        warnings.push(...outcome.warnings);
        results.push(...outcome.results);
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

  /** Only an explicit, validated warning may override the fast refusal. */
  private async judge(
    text: string,
    category: string,
    deadline: number,
    context: string,
  ): Promise<string | undefined> {
    const content = await this.complete(
      {
        model: this.config.get<string>('AI_DEFAULT_MODEL') ?? 'gemma4',
        temperature: 0,
        stream: false,
        reasoning_effort: 'none',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'moderation_review',
            strict: true,
            schema: judgePolicy.schema,
          },
        },
        messages: [
          { role: 'system', content: judgePolicy.system },
          {
            role: 'user',
            content: JSON.stringify({
              category,
              study_content: text,
              context: JSON.parse(context) as unknown,
            }),
          },
        ],
      },
      deadline,
    );
    try {
      const decision = judgeVerdict.parse(JSON.parse(content));
      return decision.verdict === 'warn' ? decision.reason : undefined;
    } catch {
      throw new Error('Unparseable moderation verdict');
    }
  }

  private async complete(
    body: Record<string, unknown>,
    deadline: number,
  ): Promise<string> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Moderation deadline exceeded');
    const apiBase = this.config.get<string>('AI_API_BASE')?.replace(/\/+$/, '');
    const apiKey = this.config.get<string>('AI_API_KEY') ?? '';
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(
        Math.min(MODERATION_CARD_TIMEOUT_MS, remaining),
      ),
    });
    if (!response.ok) throw new Error('Moderation gateway error');
    const data = (await response.json()) as ChatCompletionResponse;
    return data.choices?.[0]?.message?.content ?? '';
  }
}
