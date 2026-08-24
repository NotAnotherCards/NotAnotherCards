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
import { DATABASE_CONNECTION } from '../database/database-connection';
import { aiUsage, DeckGenerationPayload } from './schema';
import { AiGatewayService, AiParseError } from './ai-gateway.service';
import { TOPIC_GENERATION_V1 } from './prompts/topic-generation.v1';
import { TEXT_GENERATION_V1 } from './prompts/text-generation.v1';
import { MetricsService } from '../metrics/metrics.service';

interface ClaimedJobRow {
  id: string;
  user_id: string;
  type: string;
  payload: DeckGenerationPayload | string;
  attempts: number;
  max_attempts: number;
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
    // Queue depth is refreshed at scrape time from the database, so the
    // gauges are accurate regardless of which process changed the queue.
    this.metricsService?.registerAiQueueDepthProvider(async () => {
      const result = await this.db.execute(sql`
        SELECT
          count(*) FILTER (WHERE status = 'pending')::int AS pending,
          count(*) FILTER (WHERE status = 'processing')::int AS processing
        FROM ai_generation_jobs
      `);
      const row = result.rows[0] as
        { pending: number; processing: number } | undefined;
      return {
        pending: Number(row?.pending ?? 0),
        processing: Number(row?.processing ?? 0),
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
      await this.db.execute(sql`
        UPDATE ai_generation_jobs
        SET status = 'failed',
            error = 'Job timed out while processing on final attempt',
            updated_at = NOW()
        WHERE status = 'processing'
          AND locked_at < NOW() - INTERVAL '5 minutes'
          AND attempts >= max_attempts;
      `);

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
    const payload: DeckGenerationPayload =
      typeof job.payload === 'string'
        ? (JSON.parse(job.payload) as DeckGenerationPayload)
        : job.payload;

    try {
      let systemPrompt: string;
      let userPrompt: string;

      if (job.type === 'topic_deck') {
        systemPrompt = TOPIC_GENERATION_V1.system;
        userPrompt = TOPIC_GENERATION_V1.buildUserPrompt(
          payload.topic ?? '',
          payload.count,
        );
      } else {
        systemPrompt = TEXT_GENERATION_V1.system;
        userPrompt = TEXT_GENERATION_V1.buildUserPrompt(
          payload.sourceText ?? '',
          payload.count,
        );
      }

      const inference = await this.aiGateway.generateCards(
        systemPrompt,
        userPrompt,
        payload.model,
        payload.count,
      );

      // Record success and log token usage in a transaction
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE ai_generation_jobs
          SET status = 'completed',
              result = ${JSON.stringify(inference.cards)}::jsonb,
              error = NULL,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${job.id}
        `);

        await tx.insert(aiUsage).values({
          id: randomUUID(),
          userId: job.user_id,
          jobId: job.id,
          model: inference.model,
          promptTokens: inference.usage.promptTokens,
          completionTokens: inference.usage.completionTokens,
          totalTokens: inference.usage.totalTokens,
        });
      });

      this.metricsService?.aiJobsCompletedTotal.inc();
      this.metricsService?.aiTokensConsumedTotal.inc(
        { model: inference.model },
        inference.usage.totalTokens,
      );

      this.logger.log(
        `Job ${job.id} completed (${inference.cards.length} cards, ${inference.usage.totalTokens} tokens)`,
      );
    } catch (err: unknown) {
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
        } catch (usageErr) {
          this.logger.error(
            'Failed to log token usage on parse error',
            usageErr,
          );
        }
      }

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
