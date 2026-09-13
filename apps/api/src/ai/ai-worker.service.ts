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
import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
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
import { ModerationService } from '../sharing/moderation.service';
import {
  deckTakedowns,
  publishedDecks,
  type StoredModerationVerdict,
} from '../sharing/schema';
import { userDecks } from '../sync/schema';
import { syncScopeLockKey } from '../sync/sync-store';

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
    @Optional()
    private readonly moderation?: ModerationService,
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
      if (job.type === 'deck_moderation') {
        metricModel = 'moderation-thorough';
        const result = await this.executeDeckModeration(rawPayload);
        await this.completeWithoutUsage(job.id, result);
        this.metricsService?.aiJobsCompletedTotal.inc();
        this.metricsService?.observeAiJobDuration(
          metricModel,
          'completed',
          Number(process.hrtime.bigint() - startTime) / 1e9,
        );
        this.logger.log(
          `Job ${job.id} completed (deck moderation: ${result.outcome})`,
        );
        return;
      }
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
        await this.db.execute(sql`
          UPDATE ai_generation_jobs
          SET status = 'failed',
              error = ${errorMessage},
              updated_at = NOW()
          WHERE id = ${job.id}
        `);

        // The counter represents durable terminal failures only. If this update
        // fails, the job remains processing and the stalled-job sweep will own
        // the eventual transition (and its single metric increment).
        this.metricsService?.aiJobsFailedTotal.inc();
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

  private async executeDeckModeration(rawPayload: unknown) {
    const payload = z
      .object({
        deckId: z.string().min(1),
        snapshotPublishedAt: z.iso.datetime(),
      })
      .parse(rawPayload);
    const publishedAt = new Date(payload.snapshotPublishedAt);
    const [snapshot] = await this.db
      .select({
        userId: publishedDecks.userId,
        content: publishedDecks.content,
      })
      .from(publishedDecks)
      .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
      .where(
        and(
          eq(publishedDecks.deckId, payload.deckId),
          eq(publishedDecks.publishedAt, publishedAt),
          eq(publishedDecks.moderationStatus, 'visible'),
          eq(userDecks.visibility, 'public'),
          isNull(userDecks.deletedAt),
        ),
      );
    if (!snapshot)
      return {
        deckId: payload.deckId,
        outcome: 'stale' as const,
        flagged: [],
        warnings: [],
      };

    if (!this.moderation) throw new Error('Moderation service unavailable');
    const verdict = await this.moderation.checkThorough({
      deckId: payload.deckId,
      cards: snapshot.content.cards.map(({ id, front, back }) => ({
        id,
        front,
        back,
      })),
    });
    // Gateway failures never hide a deck merely because somebody reported it;
    // throwing here gives the queue its normal retry/backoff behaviour.
    if (verdict.reason === 'moderation unavailable') {
      throw new Error(verdict.reason);
    }

    const storedVerdict: StoredModerationVerdict = {
      ...(verdict.reason ? { reason: verdict.reason } : {}),
      flagged: verdict.flagged,
      warnings: verdict.warnings,
    };
    const outcome = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('deck_report_deck_' || ${payload.deckId}))`,
      );
      const [current] = await tx
        .select({ userId: publishedDecks.userId })
        .from(publishedDecks)
        .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
        .where(
          and(
            eq(publishedDecks.deckId, payload.deckId),
            eq(publishedDecks.publishedAt, publishedAt),
            eq(publishedDecks.moderationStatus, 'visible'),
            eq(userDecks.visibility, 'public'),
            isNull(userDecks.deletedAt),
          ),
        );
      if (!current) return 'stale' as const;
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(current.userId).toString()})`,
      );
      // Publishing and unpublishing take the scope lock. Re-read after taking
      // it so a verdict can never land on a snapshot replaced while we waited.
      const [lockedCurrent] = await tx
        .select({ userId: publishedDecks.userId })
        .from(publishedDecks)
        .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
        .where(
          and(
            eq(publishedDecks.deckId, payload.deckId),
            eq(publishedDecks.publishedAt, publishedAt),
            eq(publishedDecks.moderationStatus, 'visible'),
            eq(userDecks.visibility, 'public'),
            isNull(userDecks.deletedAt),
          ),
        );
      if (!lockedCurrent) return 'stale' as const;

      const now = new Date();
      await tx
        .update(publishedDecks)
        .set({ moderationVerdict: storedVerdict, moderatedAt: now })
        .where(
          and(
            eq(publishedDecks.deckId, payload.deckId),
            eq(publishedDecks.publishedAt, publishedAt),
          ),
        );
      if (verdict.ok) return 'clean' as const;

      await tx
        .update(publishedDecks)
        .set({ moderationStatus: 'blocked' })
        .where(eq(publishedDecks.deckId, payload.deckId));
      await tx.insert(deckTakedowns).values({
        id: randomUUID(),
        deckId: payload.deckId,
        source: 'automatic',
        reason: verdict.reason,
        verdict: storedVerdict,
        snapshotPublishedAt: publishedAt,
      });
      await tx
        .update(userDecks)
        .set({
          visibility: 'private',
          rev: sql`nextval('remelon_rev')`,
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(userDecks.id, payload.deckId),
            eq(userDecks.userId, lockedCurrent.userId),
            isNull(userDecks.deletedAt),
          ),
        );
      return 'blocked' as const;
    });

    return {
      deckId: payload.deckId,
      outcome,
      flagged: verdict.flagged,
      warnings: verdict.warnings,
    };
  }

  private async completeWithoutUsage(
    jobId: string,
    result: {
      deckId: string;
      outcome: 'clean' | 'blocked' | 'stale';
      flagged: { cardId: string; reason: string; classifier?: string }[];
      warnings: { cardId: string; reason: string; classifier?: string }[];
    },
  ) {
    const persisted = {
      outcome: result.outcome,
      flagged: result.flagged,
      warnings: result.warnings,
    };
    await this.db.transaction(async (tx) => {
      if (result.outcome === 'stale') {
        // A report can arrive for a republished snapshot while this job still
        // owns the deck's single active slot. Serialize with report creation,
        // finish the stale job, then carry that newer report into a fresh job.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext('deck_report_deck_' || ${result.deckId}))`,
        );
      }
      await tx.execute(sql`
        UPDATE ai_generation_jobs
        SET status = 'completed',
            result = ${JSON.stringify(persisted)}::jsonb,
            error = NULL,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${jobId}
      `);
      if (result.outcome !== 'stale') return;

      const followUp = await tx.execute(sql`
        SELECT p.published_at, r.reporter_user_id
        FROM published_decks p
        JOIN user_decks d ON d.id = p.deck_id
        JOIN deck_reports r
          ON r.deck_id = p.deck_id
         AND r.snapshot_published_at = p.published_at
        WHERE p.deck_id = ${result.deckId}
          AND p.moderation_status = 'visible'
          AND p.moderated_at IS NULL
          AND d.visibility = 'public'
          AND d.deleted_at IS NULL
        ORDER BY r.created_at ASC
        LIMIT 1
      `);
      const row = followUp.rows[0] as
        { published_at: Date | string; reporter_user_id: string } | undefined;
      if (!row) return;
      await tx.execute(sql`
        INSERT INTO ai_generation_jobs (id, user_id, type, payload)
        VALUES (
          ${randomUUID()},
          ${row.reporter_user_id},
          'deck_moderation',
          ${JSON.stringify({
            deckId: result.deckId,
            snapshotPublishedAt: new Date(row.published_at).toISOString(),
          })}::jsonb
        )
      `);
    });
  }
}
