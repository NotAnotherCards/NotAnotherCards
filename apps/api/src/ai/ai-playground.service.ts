import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { AiPlaygroundEvent, CreateAiJobInput } from '@repo/schemas';
import {
  AiGatewayService,
  AiParseError,
  AiStreamError,
  type InferenceResult,
} from './ai-gateway.service';
import { AiLimitsService } from './ai-limits.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { aiGenerationJobs } from './schema';
import { MetricsService } from '../metrics/metrics.service';
import { TOPIC_GENERATION_V1 } from './prompts/topic-generation.v1';

@Injectable()
export class AiPlaygroundService {
  private readonly logger = new Logger(AiPlaygroundService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<Record<string, unknown>>,
    private readonly gateway: AiGatewayService,
    private readonly limits: AiLimitsService,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async stream(
    userId: string,
    input: Extract<CreateAiJobInput, { type: 'topic_deck' }>,
    res: Response,
  ): Promise<void> {
    let model =
      input.model ?? this.config.get<string>('AI_DEFAULT_MODEL') ?? 'gemma4';
    const usageId = await this.limits.reservePlaygroundUsage(userId, model);
    const disconnect = new AbortController();
    const signal = AbortSignal.any([
      disconnect.signal,
      AbortSignal.timeout(
        Number(this.config.get<string>('AI_REQUEST_TIMEOUT_MS') ?? 60000),
      ),
    ]);
    const onClose = () => {
      if (!res.writableEnded) disconnect.abort();
    };
    res.on('close', onClose);
    if (res.destroyed) disconnect.abort();

    let usage: InferenceResult['usage'] = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let terminal: AiPlaygroundEvent;
    try {
      try {
        signal.throwIfAborted();
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const result = await this.gateway.generateCards(
          TOPIC_GENERATION_V1.system,
          TOPIC_GENERATION_V1.buildUserPrompt(input.topic, input.count),
          input.model,
          input.count,
          {
            signal,
            onDelta: async (delta) => {
              signal.throwIfAborted();
              if (
                !res.write(
                  `data: ${JSON.stringify({ type: 'delta', delta })}\n\n`,
                )
              ) {
                await once(res, 'drain', { signal });
              }
            },
          },
        );
        usage = result.usage;
        model = result.model;
        terminal = { type: 'result', cards: result.cards };
      } catch (error) {
        if (error instanceof AiParseError || error instanceof AiStreamError) {
          usage = error.usage;
          model = error.model;
        }
        this.logger.warn(
          error instanceof Error ? error.message : String(error),
        );
        terminal = {
          type: 'error',
          message:
            signal.aborted && !disconnect.signal.aborted
              ? 'Card generation timed out. Please try again.'
              : 'Card generation could not be completed. Please try again.',
        };
      }

      // Finalize before allowing the browser to report success. The job row
      // is born completed (or failed), so the worker never picks it up; it
      // exists so the run shows in the playground's history like any other.
      try {
        const jobId = randomUUID();
        await this.db.insert(aiGenerationJobs).values({
          id: jobId,
          userId,
          type: 'topic_deck',
          status: terminal.type === 'result' ? 'completed' : 'failed',
          payload: { topic: input.topic, count: input.count, model },
          result: terminal.type === 'result' ? terminal.cards : null,
          error: terminal.type === 'error' ? terminal.message : null,
          attempts: 1,
          completedAt: new Date(),
        });
        await this.limits.completePlaygroundUsage(usageId, model, usage, jobId);
        this.metrics?.aiTokensConsumedTotal.inc({ model }, usage.totalTokens);
      } catch (error) {
        this.logger.error('Failed to record playground usage', error);
        terminal = {
          type: 'error',
          message: 'Unable to record generation usage. Please try again later.',
        };
      }
      if (!res.destroyed && !res.writableEnded) {
        res.end(`data: ${JSON.stringify(terminal)}\n\n`);
      }
    } finally {
      res.off('close', onClose);
      disconnect.abort();
    }
  }
}
