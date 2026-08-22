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

interface ChatCompletionResponse {
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
  ): Promise<InferenceResult> {
    const apiBase = this.config.get<string>('AI_API_BASE');
    const apiKey = this.config.get<string>('AI_API_KEY') ?? '';
    const model =
      requestedModel || this.config.get<string>('AI_DEFAULT_MODEL') || 'qwen';

    // If no backend configured, run mock mode (enables docker compose without AI box)
    if (!apiBase) {
      this.logger.log('No AI_API_BASE provided. Using mock generator.');
      return this.mockGeneration(userPrompt, model);
    }

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
      }),
    });

    if (!res.ok) {
      throw new Error(`AI gateway error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const rawContent: string = data.choices?.[0]?.message?.content ?? '';
    const cards = this.parseCardsFromJson(rawContent);

    return {
      cards,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model,
    };
  }

  private parseCardsFromJson(raw: string): CardOutput[] {
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

    return (parsed as RawCardItem[]).map((item, idx) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof item.front !== 'string' ||
        typeof item.back !== 'string'
      ) {
        throw new Error(`Card at index ${idx} is missing front or back string`);
      }
      return {
        front: item.front.slice(0, 500),
        back: item.back.slice(0, 500),
      };
    });
  }

  private mockGeneration(prompt: string, model: string): InferenceResult {
    return {
      cards: [
        {
          front: `What is the core concept of "${prompt.slice(0, 30)}"?`,
          back: 'Fundamental concept explained.',
        },
        {
          front: 'Key application or syntax?',
          back: 'Practical usage example.',
        },
      ],
      usage: { promptTokens: 35, completionTokens: 45, totalTokens: 80 },
      model: `${model}-mock`,
    };
  }
}
