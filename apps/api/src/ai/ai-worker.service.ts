import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  textCardsPayloadSchema,
  topicDeckPayloadSchema,
  wordNotePayloadSchema,
} from '@repo/schemas';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { aiUsage, type GenerationResult, type JobType } from './schema';
import {
  AiGatewayService,
  AiParseError,
  type InferenceResult,
} from './ai-gateway.service';
import { TOPIC_GENERATION_V1 } from './prompts/topic-generation.v1';
import { TEXT_GENERATION_V1 } from './prompts/text-generation.v1';
import { MetricsService } from '../metrics/metrics.service';
import { WORD_NOTE_V1 } from './prompts/word-note.v1';
import { assembleWordNoteCandidate } from './word-note';

interface ClaimedJobRow {
  id: string;
  user_id: string;
  type: JobType;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

function unsupportedJobType(type: never): never {
  throw new Error(`Unsupported AI job type: ${String(type)}`);
}

@Injectable()
export class AiWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiWorkerService.name);
  private timer?: NodeJS.Timeout;
  private isProcessing = false;
  private readonly pollIntervalMs: number;
  private readonly workerEnabled: boolean;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<Record<string, unknown>>,
    private readonly aiGateway: AiGatewayService,
    private readonly config: ConfigService,
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {
    this.pollIntervalMs = Number(
      this.config.get<string>('AI_WORKER_POLL_INTERVAL_MS') ?? 2000,
    );
    this.workerEnabled =
      this.config.get<string>('AI_WORKER_ENABLED') !== 'false' &&
      process.env.NODE_ENV !== 'test';
  }

  onModuleInit() {
    // Queue depth is refreshed at scrape time from the database using indexed status query
    this.metricsService?.registerAiQueueDepthProvider(async () => {
      const result = await this.db.execute(sql`
        SELECT
          count(*) FILTER (WHERE status = 'pending')::int AS pending,
          count(*) FILTER (WHERE status = 'processing')::int AS processing,
          count(*) FILTER (WHERE status = 'failed')::int AS failed
        FROM ai_generation_jobs
        WHERE status IN ('pending', 'processing', 'failed')
      `);
      const row = result.rows[0] as
        { pending: number; processing: number; failed: number } | undefined;
      return {
        pending: Number(row?.pending ?? 0),
        processing: Number(row?.processing ?? 0),
        failed: Number(row?.failed ?? 0),
      };
    });

    if (this.workerEnabled) {
      this.timer = setInterval(() => {
        void this.processNextJob();
      }, this.pollIntervalMs);
      this.logger.log(
        `AI Worker started with polling interval ${this.pollIntervalMs}ms`,
      );
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Attempts to claim and process one pending job.
   * Returns true if a job was found and processed, false if queue was empty.
   */
  async processNextJob(): Promise<boolean> {
    if (this.isProcessing) return false;
    this.isProcessing = true;

    try {
      // 1. Recover exhausted stalled jobs: any job stuck in processing with max attempts is marked failed
      const sweepResult = await this.db.execute(sql`
        UPDATE ai_generation_jobs
        SET status = 'failed',
            error = 'Job timed out while processing on final attempt',
            updated_at = NOW()
        WHERE status = 'processing'
          AND locked_at < NOW() - INTERVAL '5 minutes'
          AND attempts >= max_attempts
        RETURNING id;
      `);

      if (sweepResult.rows.length > 0) {
        this.metricsService?.aiJobsFailedTotal.inc(sweepResult.rows.length);
      }

      // 2. Atomic dequeue with row lock: select and update 1 pending (due for run) or stalled retryable job
      const claimResult = await this.db.execute(sql`
        UPDATE ai_generation_jobs
        SET status = 'processing',
            locked_at = NOW(),
            attempts = attempts + 1,
            updated_at = NOW()
        WHERE id = (
          SELECT id FROM ai_generation_jobs
          WHERE (
            (status = 'pending' AND (next_run_at IS NULL OR next_run_at <= NOW()))
            OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes' AND attempts < max_attempts)
          )
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING *;
      `);

      const row = claimResult.rows[0] as unknown as ClaimedJobRow | undefined;
      if (!row) {
        return false;
      }

      await this.executeJob(row);
      return true;
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
      this.logger.error('Worker error during job execution', errorMsg);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: ClaimedJobRow) {
    const startTime = process.hrtime.bigint();
    let metricModel = 'unknown';

    try {
      const rawPayload: unknown =
        typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      let result: GenerationResult;
      let usage: InferenceResult['usage'];
      let model: string;
      let resultLabel: string;

      switch (job.type) {
        case 'topic_deck': {
          const payload = topicDeckPayloadSchema.parse(rawPayload);
          metricModel = payload.model ?? metricModel;
          const inference = await this.aiGateway.generateCards(
            TOPIC_GENERATION_V1.system,
            TOPIC_GENERATION_V1.buildUserPrompt(payload.topic, payload.count),
            payload.model,
            payload.count,
          );
          result = inference.cards;
          usage = inference.usage;
          model = inference.model;
          metricModel = model;
          resultLabel = `${result.length} cards`;
          break;
        }
        case 'text_cards': {
          const payload = textCardsPayloadSchema.parse(rawPayload);
          metricModel = payload.model ?? metricModel;
          const inference = await this.aiGateway.generateCards(
            TEXT_GENERATION_V1.system,
            TEXT_GENERATION_V1.buildUserPrompt(
              payload.sourceText,
              payload.count,
            ),
            payload.model,
            payload.count,
          );
          result = inference.cards;
          usage = inference.usage;
          model = inference.model;
          metricModel = model;
          resultLabel = `${result.length} cards`;
          break;
        }
        case 'word_note': {
          const payload = wordNotePayloadSchema.parse(rawPayload);
          metricModel = payload.model ?? metricModel;
          const inference = await this.aiGateway.generateObject(
            WORD_NOTE_V1.system,
            WORD_NOTE_V1.buildUserPrompt(payload),
            payload.model,
          );
          try {
            result = assembleWordNoteCandidate(payload, inference.value);
          } catch (error: unknown) {
            throw new AiParseError(
              error instanceof Error ? error.message : String(error),
              inference.usage,
              inference.model,
            );
          }
          usage = inference.usage;
          model = inference.model;
          metricModel = model;
          resultLabel = '1 word note';
          break;
        }
        default:
          unsupportedJobType(job.type);
      }

      // Record success and log token usage in a transaction
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE ai_generation_jobs
          SET status = 'completed',
              result = ${JSON.stringify(result)}::jsonb,
              payload = payload || jsonb_build_object('model', ${model}::text),
              error = NULL,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${job.id}
        `);

        await tx.insert(aiUsage).values({
          id: randomUUID(),
          userId: job.user_id,
          jobId: job.id,
          model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        });
      });

      this.metricsService?.aiJobsCompletedTotal.inc();
      this.metricsService?.aiTokensConsumedTotal.inc(
        { model },
        usage.totalTokens,
      );
      const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
      this.metricsService?.observeAiJobDuration(
        model,
        'completed',
        durationSeconds,
      );

      this.logger.log(
        `Job ${job.id} completed (${resultLabel}, ${usage.totalTokens} tokens in ${durationSeconds.toFixed(2)}s)`,
      );
    } catch (err: unknown) {
      const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
      const isFinalAttempt = job.attempts >= job.max_attempts;
      const nextStatus = isFinalAttempt ? 'failed' : 'pending';
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown generation error';

      // Exponential backoff: attempt 1 -> 20s, attempt 2 -> 40s (capped at 300s)
      const backoffSeconds = Math.min(
        300,
        Math.pow(2, Math.max(1, job.attempts)) * 10,
      );

      // If gateway returned usage before parse failure, log the token usage
      if (err instanceof AiParseError && err.usage) {
        metricModel = err.model;
        try {
          await this.db.insert(aiUsage).values({
            id: randomUUID(),
            userId: job.user_id,
            jobId: job.id,
            model: err.model,
            promptTokens: err.usage.promptTokens,
            completionTokens: err.usage.completionTokens,
            totalTokens: err.usage.totalTokens,
          });
          this.metricsService?.aiTokensConsumedTotal.inc(
            { model: err.model },
            err.usage.totalTokens,
          );
        } catch (usageErr) {
          this.logger.error(
            'Failed to log token usage on parse error',
            usageErr,
          );
        }
      }

      this.metricsService?.observeAiJobDuration(
        metricModel,
        'failed',
        durationSeconds,
      );

      if (isFinalAttempt) {
        this.metricsService?.aiJobsFailedTotal.inc();

        await this.db.execute(sql`
          UPDATE ai_generation_jobs
          SET status = 'failed',
              error = ${errorMessage},
              updated_at = NOW()
          WHERE id = ${job.id}
        `);
      } else {
        await this.db.execute(sql`
          UPDATE ai_generation_jobs
          SET status = 'pending',
              next_run_at = NOW() + (${backoffSeconds} || ' seconds')::interval,
              error = ${errorMessage},
              updated_at = NOW()
          WHERE id = ${job.id}
        `);
      }

      this.logger.warn(
        `Job ${job.id} execution failed (attempt ${job.attempts}/${job.max_attempts}, next status: ${nextStatus}, backoff: ${backoffSeconds}s): ${errorMessage}`,
      );
    }
  }
}
