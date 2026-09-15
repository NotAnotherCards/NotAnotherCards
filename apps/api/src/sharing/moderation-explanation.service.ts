import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { once } from 'node:events';
import type { Response } from 'express';
import {
  AiGatewayService,
  AiStreamError,
  type InferenceResult,
} from '../ai/ai-gateway.service';
import { AiLimitsService } from '../ai/ai-limits.service';

export interface ModerationExplanationInput {
  cardId: string;
  front: string;
  back: string;
  reason: string;
}

@Injectable()
export class ModerationExplanationService {
  private readonly logger = new Logger(ModerationExplanationService.name);

  constructor(
    private readonly gateway: AiGatewayService,
    private readonly config: ConfigService,
    private readonly limits: AiLimitsService,
  ) {}

  async stream(
    userId: string,
    input: ModerationExplanationInput,
    res: Response,
  ): Promise<void> {
    let model = this.config.get<string>('AI_DEFAULT_MODEL') ?? 'gemma4';
    // Reserve before opening SSE so quota failures remain ordinary HTTP 429s.
    const usageId = await this.limits.reservePlaygroundUsage(userId, model);
    let usage: InferenceResult['usage'] = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    const disconnected = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) disconnected.abort();
    };
    res.on('close', onClose);

    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const result = await this.gateway.generateText(
        [
          'Explain an automated moderation finding to the owner of a study flashcard.',
          'Use two or three concise sentences. Say what likely triggered the category and suggest a concrete edit.',
          'If the category appears to be a false positive in context, say so plainly. Do not repeat harmful details unnecessarily.',
        ].join(' '),
        `Category: ${input.reason}\nFront: ${input.front}\nBack: ${input.back}`,
        model,
        {
          signal: disconnected.signal,
          onDelta: async (delta) => {
            disconnected.signal.throwIfAborted();
            if (
              !res.write(
                `data: ${JSON.stringify({ type: 'delta', delta })}\n\n`,
              )
            ) {
              await once(res, 'drain', { signal: disconnected.signal });
            }
          },
        },
      );
      usage = result.usage;
      model = result.model;
      if (!res.destroyed && !res.writableEnded) {
        res.end(
          `data: ${JSON.stringify({ type: 'result', explanation: result.text })}\n\n`,
        );
      }
    } catch (error) {
      if (error instanceof AiStreamError) {
        usage = error.usage;
        model = error.model;
      }
      if (!disconnected.signal.aborted) {
        this.logger.warn(
          error instanceof AiStreamError || error instanceof Error
            ? error.message
            : String(error),
        );
        if (!res.destroyed && !res.writableEnded) {
          res.end(
            `data: ${JSON.stringify({ type: 'error', message: 'The explanation could not be generated. Please try again.' })}\n\n`,
          );
        }
      }
    } finally {
      await this.limits
        .completePlaygroundUsage(usageId, model, usage)
        .catch((error: unknown) =>
          this.logger.error('Failed to record explanation usage', error),
        );
      res.off('close', onClose);
      disconnected.abort();
    }
  }
}
