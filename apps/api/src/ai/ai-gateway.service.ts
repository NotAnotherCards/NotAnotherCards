import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardOutput } from './schema';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

export interface InferenceResult {
  cards: CardOutput[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface ObjectInferenceResult {
  value: Record<string, unknown>;
  usage: InferenceResult['usage'];
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

interface StreamingOptions {
  onDelta: (delta: string) => void | Promise<void>;
  signal?: AbortSignal;
}

const completionChunkSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().nullish() }).optional(),
      }),
    )
    .optional(),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().max(2147483647),
      completion_tokens: z.number().int().nonnegative().max(2147483647),
      total_tokens: z.number().int().nonnegative().max(2147483647),
    })
    .nullish(),
  error: z.object({ message: z.string() }).optional(),
});

/** Reassemble SSE events before parsing JSON, including split UTF-8 bytes. */
export async function* sseData(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let tail = '';
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error('AI stream ended before [DONE]');
      size += value.byteLength;
      if (size > 1_000_000) throw new Error('AI response is too large');
      tail += decoder.decode(value, { stream: true });
      for (;;) {
        const boundary = /\r?\n\r?\n/.exec(tail);
        if (!boundary) break;
        const event = tail.slice(0, boundary.index);
        tail = tail.slice(boundary.index + boundary[0].length);
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (!data) continue;
        if (data.trim() === '[DONE]') return;
        yield data;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Carries known usage even if a stream is interrupted after the usage event. */
export class AiStreamError extends Error {
  constructor(
    message: string,
    public readonly usage: InferenceResult['usage'],
    public readonly model: string,
  ) {
    super(message);
    this.name = 'AiStreamError';
  }
}

interface RawCardItem {
  front?: unknown;
  back?: unknown;
}

interface GatewaySettings {
  apiBase: string | undefined;
  apiKey: string;
  isMock: boolean;
  model: string;
}

interface Completion {
  rawContent: string;
  usage: InferenceResult['usage'];
  model: string;
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
    stream?: StreamingOptions,
  ): Promise<InferenceResult> {
    const settings = this.gatewaySettings(requestedModel);

    if (!settings.apiBase) {
      if (settings.isMock) {
        this.logger.log('AI_MOCK is active. Using mock generator.');
        const mock = this.mockGeneration(
          userPrompt,
          settings.model,
          requestedCount,
        );
        if (stream) {
          const signal = this.requestSignal(stream.signal);
          for (const piece of JSON.stringify(mock.cards).match(
            /[\s\S]{1,24}/g,
          ) ?? []) {
            await delay(40, undefined, { signal });
            await stream.onDelta(piece);
          }
        }
        return mock;
      }
      throw new Error(
        'AI gateway is not configured (AI_API_BASE is unset). Jobs remain queued.',
      );
    }

    const completion = stream
      ? await this.requestStreamingCompletion(
          systemPrompt,
          userPrompt,
          settings,
          stream,
        )
      : await this.requestCompletion(systemPrompt, userPrompt, settings);
    let cards: CardOutput[];
    try {
      cards = this.parseCardsFromJson(completion.rawContent, requestedCount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AiParseError(msg, completion.usage, completion.model);
    }

    return { cards, usage: completion.usage, model: completion.model };
  }

  private async requestStreamingCompletion(
    systemPrompt: string,
    userPrompt: string,
    settings: GatewaySettings,
    stream: StreamingOptions,
  ): Promise<Completion> {
    const completion: Completion = {
      rawContent: '',
      model: settings.model,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
    try {
      const response = await this.chatRequest(
        systemPrompt,
        userPrompt,
        settings,
        true,
        stream.signal,
      );
      if (!response.body) throw new Error('AI gateway returned no stream');
      for await (const data of sseData(response.body)) {
        const chunk = completionChunkSchema.parse(JSON.parse(data));
        if (chunk.model) completion.model = chunk.model;
        if (chunk.usage)
          completion.usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        if (chunk.error) throw new Error(chunk.error.message);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          completion.rawContent += delta;
          await stream.onDelta(delta);
        }
      }
      return completion;
    } catch (error) {
      throw new AiStreamError(
        error instanceof Error ? error.message : String(error),
        completion.usage,
        completion.model,
      );
    }
  }

  async generateObject(
    systemPrompt: string,
    userPrompt: string,
    requestedModel?: string,
  ): Promise<ObjectInferenceResult> {
    const settings = this.gatewaySettings(requestedModel);
    if (!settings.apiBase) {
      if (settings.isMock) {
        this.logger.log('AI_MOCK is active. Using mock generator.');
        return this.mockObjectGeneration(settings.model);
      }
      throw new Error(
        'AI gateway is not configured (AI_API_BASE is unset). Jobs remain queued.',
      );
    }

    const completion = await this.requestCompletion(
      systemPrompt,
      userPrompt,
      settings,
    );
    try {
      return {
        value: this.parseObjectFromJson(completion.rawContent),
        usage: completion.usage,
        model: completion.model,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AiParseError(msg, completion.usage, completion.model);
    }
  }

  private gatewaySettings(requestedModel?: string): GatewaySettings {
    const mock = this.config.get<string>('AI_MOCK');
    return {
      // A trailing slash produced `POST //chat/completions`, which gateways
      // answer with 404.
      apiBase: this.config.get<string>('AI_API_BASE')?.replace(/\/+$/, ''),
      apiKey: this.config.get<string>('AI_API_KEY') ?? '',
      isMock:
        mock === '1' || mock === 'true' || process.env.NODE_ENV === 'test',
      model:
        requestedModel ||
        this.config.get<string>('AI_DEFAULT_MODEL') ||
        'gemma4',
    };
  }

  private async chatRequest(
    systemPrompt: string,
    userPrompt: string,
    settings: GatewaySettings,
    stream: boolean,
    signal?: AbortSignal,
  ): Promise<Response> {
    if (!settings.apiBase) throw new Error('AI gateway is not configured');
    const res = await fetch(`${settings.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey
          ? { Authorization: `Bearer ${settings.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: settings.model,
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
        // usage only arrives in a stream's final chunk when asked for
        ...(stream
          ? { stream: true, stream_options: { include_usage: true } }
          : {}),
      }),
      signal: this.requestSignal(signal),
    });

    if (!res.ok) {
      throw new Error(`AI gateway error (${res.status}): ${await res.text()}`);
    }
    return res;
  }

  private async requestCompletion(
    systemPrompt: string,
    userPrompt: string,
    settings: GatewaySettings,
  ): Promise<Completion> {
    const res = await this.chatRequest(
      systemPrompt,
      userPrompt,
      settings,
      false,
    );
    const data = (await res.json()) as ChatCompletionResponse;
    const usage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };

    const rawContent: string = data.choices?.[0]?.message?.content ?? '';
    return {
      rawContent,
      usage,
      // the gateway reports the deployment that answered; on a router
      // fallback that is not the alias we asked for
      model: data.model ?? settings.model,
    };
  }

  private parseCardsFromJson(
    raw: string,
    requestedCount: number,
  ): CardOutput[] {
    const cleaned = this.stripThinking(raw);
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

  private parseObjectFromJson(raw: string): Record<string, unknown> {
    const cleaned = this.stripThinking(raw);
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI response did not contain a valid JSON object');
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('Parsed AI output is not an object');
    }
    return parsed as Record<string, unknown>;
  }

  private stripThinking(raw: string): string {
    return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  private requestSignal(signal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(
      Number(this.config.get<string>('AI_REQUEST_TIMEOUT_MS') ?? 60000),
    );
    return signal ? AbortSignal.any([timeout, signal]) : timeout;
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

  private mockObjectGeneration(model: string): ObjectInferenceResult {
    return {
      value: {
        word: 'Wort',
        translation: 'word',
        part_of_speech: 'noun',
        example: 'Das Wort steht in einem Satz.',
        example_translation: 'The word appears in a sentence.',
        pronunciation: 'vɔʁt',
      },
      usage: {
        promptTokens: 25,
        completionTokens: 35,
        totalTokens: 60,
      },
      model: `${model}-mock`,
    };
  }
}
