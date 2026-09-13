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

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly config: ConfigService) {}

  async check(input: ModerationInput): Promise<ModerationVerdict> {
    return this.checkWithModels(input, ['moderation'], false);
  }

  /**
   * A report is stronger evidence than a normal publish attempt. Re-check the
   * immutable public snapshot with the fast gate and an independently
   * configured second classifier. The alias lets the benchmark choose the
   * actual model without changing application code.
   */
  async checkThorough(input: ModerationInput): Promise<ModerationVerdict> {
    const secondModel =
      this.config.get<string>('MODERATION_THOROUGH_MODEL') ??
      'moderation-thorough';
    return this.checkWithModels(input, ['moderation', secondModel], true);
  }

  private async checkWithModels(
    input: ModerationInput,
    models: string[],
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
      startedAt + moderationDeadlineMs(input.cards.length * models.length);
    try {
      for (const model of models) {
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
              model,
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
          const match = content.match(
            /Safety:\s*(Safe|Unsafe|Controversial)\b(?:[\s\S]*?Categories:\s*([^\n]*))?/i,
          );
          if (!match) throw new Error('Unparseable moderation verdict');

          const grade = match[1].toLowerCase();
          const category = match[2]?.trim();
          const reason =
            category && category.toLowerCase() !== 'none' ? category : match[1];
          const finding = {
            cardId: card.id,
            reason,
            ...(identifyClassifier ? { classifier: model } : {}),
          };
          if (grade === 'unsafe') flagged.push(finding);
          if (grade === 'controversial') warnings.push(finding);
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
