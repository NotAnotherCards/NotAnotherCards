import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface ModerationVerdict {
  ok: boolean;
  /** Why the deck was refused when no individual card was flagged. */
  reason?: string;
  flagged: { cardId: string; reason: string }[];
  warnings: { cardId: string; reason: string }[];
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
    try {
      for (const card of input.cards) {
        const response = await fetch(`${apiBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: 'moderation',
            temperature: 0,
            stream: false,
            messages: [
              { role: 'user', content: `${card.front}\n${card.back}` },
            ],
          }),
          signal: AbortSignal.timeout(30_000),
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
        if (grade === 'unsafe') flagged.push({ cardId: card.id, reason });
        if (grade === 'controversial')
          warnings.push({ cardId: card.id, reason });
      }
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`Moderation failed for deck ${input.deckId}: ${name}`);
      return unavailable();
    }

    return { ok: flagged.length === 0, flagged, warnings };
  }
}
