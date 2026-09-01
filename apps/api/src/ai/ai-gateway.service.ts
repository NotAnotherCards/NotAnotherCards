import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardOutput } from './schema';

export interface InferenceResult {
  cards: CardOutput[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export class AiParseError extends Error {
  constructor(
    message: string,
    public readonly usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    public readonly model: string,
  ) {
    super(message);
    this.name = 'AiParseError';
  }
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface RawCardItem {
  front?: unknown;
  back?: unknown;
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(private readonly config: ConfigService) {}

  async generateCards(
    systemPrompt: string,
    userPrompt: string,
    requestedModel?: string,
    requestedCount = 5,
  ): Promise<InferenceResult> {
    // A trailing slash here produced `POST //chat/completions`, which the
    // gateway answers with 404, so every job failed until the env was fixed.
    const apiBase = this.config.get<string>('AI_API_BASE')?.replace(/\/+$/, '');
    const apiKey = this.config.get<string>('AI_API_KEY') ?? '';
    const isMockExplicit =
      this.config.get<string>('AI_MOCK') === '1' ||
      this.config.get<string>('AI_MOCK') === 'true' ||
      process.env.NODE_ENV === 'test';
    const model =
      requestedModel || this.config.get<string>('AI_DEFAULT_MODEL') || 'gemma4';

    // If no endpoint is configured:
    // When AI_MOCK is explicitly enabled (or in tests), use mock generator.
    // Otherwise, throw an error so the job stays visibly queued in pending per docs/deployment.md.
    if (!apiBase) {
      if (isMockExplicit) {
        this.logger.log('AI_MOCK is active. Using mock generator.');
        return this.mockGeneration(userPrompt, model, requestedCount);
      }
      throw new Error(
        'AI gateway is not configured (AI_API_BASE is unset). Jobs remain queued.',
      );
    }

    const timeoutMs = Number(
      this.config.get<string>('AI_REQUEST_TIMEOUT_MS') ?? 60000,
    );

    const res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        // Generation must not reason: with reasoning, a five-card job runs
        // 26-56s against the 60s timeout (a measured 4s margin on an idle
        // GPU); without it, ~3s and a tenth of the tokens. Works on the
        // LiteLLM path and on OpenAI-compatible fallbacks; providers that
        // ignore it are no worse off.
        reasoning_effort: 'none',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`AI gateway error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const usage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };

    const rawContent: string = data.choices?.[0]?.message?.content ?? '';
    let cards: CardOutput[];
    try {
      cards = this.parseCardsFromJson(rawContent, requestedCount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AiParseError(msg, usage, model);
    }

    return {
      cards,
      usage,
      // the gateway reports the deployment that answered; on a router
      // fallback that is not the alias we asked for
      model: data.model ?? model,
    };
  }

  private parseCardsFromJson(
    raw: string,
    requestedCount: number,
  ): CardOutput[] {
    // 1. Strip reasoning thoughts if model produced thinking tokens
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // 2. Extract JSON bracket boundaries [ ... ]
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI response did not contain a valid JSON array');
    }

    const jsonStr = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('Parsed AI output is not an array');
    }

    const maxCards = Math.max(1, Math.min(requestedCount, 20));
    const slice = parsed.slice(0, maxCards);

    return (slice as RawCardItem[]).map((item, idx) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof item.front !== 'string' ||
        typeof item.back !== 'string'
      ) {
        throw new Error(`Card at index ${idx} is missing front or back string`);
      }
      return {
        front: item.front.slice(0, 1000),
        back: item.back.slice(0, 1000),
      };
    });
  }

  private mockGeneration(
    prompt: string,
    model: string,
    requestedCount = 5,
  ): InferenceResult {
    const count = Math.max(1, Math.min(requestedCount, 20));
    const cards: CardOutput[] = [];

    for (let i = 1; i <= count; i++) {
      cards.push({
        front: `Card ${i}: What is the core concept of "${prompt.slice(0, 30)}"?`,
        back: `Explanation and practical application for card ${i}.`,
      });
    }

    return {
      cards,
      usage: {
        promptTokens: 20 + count * 5,
        completionTokens: 25 + count * 10,
        totalTokens: 45 + count * 15,
      },
      model: `${model}-mock`,
    };
  }
}
