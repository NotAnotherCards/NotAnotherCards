import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { aiUsage, DeckGenerationPayload } from './schema';
import { AiGatewayService } from './ai-gateway.service';
import { TOPIC_GENERATION_V1 } from './prompts/topic-generation.v1';
import { TEXT_GENERATION_V1 } from './prompts/text-generation.v1';

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
  ) {
    this.pollIntervalMs = Number(
      this.config.get<string>('AI_WORKER_POLL_INTERVAL_MS') ?? 2000,
    );
    this.workerEnabled =
      this.config.get<string>('AI_WORKER_ENABLED') !== 'false' &&
      process.env.NODE_ENV !== 'test';
  }

  onModuleInit() {
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
      // Atomic dequeue with row lock: select and update 1 pending or stalled job
      const claimResult = await this.db.execute(sql`
        UPDATE ai_generation_jobs
        SET status = 'processing',
            locked_at = NOW(),
            attempts = attempts + 1,
            updated_at = NOW()
        WHERE id = (
          SELECT id FROM ai_generation_jobs
          WHERE (status = 'pending' OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes'))
            AND attempts < max_attempts
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

      this.logger.log(
        `Job ${job.id} completed (${inference.cards.length} cards, ${inference.usage.totalTokens} tokens)`,
      );
    } catch (err: unknown) {
      const isFinalAttempt = job.attempts >= job.max_attempts;
      const nextStatus = isFinalAttempt ? 'failed' : 'pending';
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown generation error';

      await this.db.execute(sql`
        UPDATE ai_generation_jobs
        SET status = ${nextStatus},
            error = ${errorMessage},
            updated_at = NOW()
        WHERE id = ${job.id}
      `);

      this.logger.warn(
        `Job ${job.id} execution failed (attempt ${job.attempts}/${job.max_attempts}, next status: ${nextStatus}): ${errorMessage}`,
      );
    }
  }
}
