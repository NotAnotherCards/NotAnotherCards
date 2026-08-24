import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { aiGenerationJobs, aiUsage } from './schema';

export interface QuotaStatus {
  usedTokens: number;
  maxTokens: number;
  requestsUsed: number;
  maxRequests: number;
  activePendingJobs: number;
  maxPendingJobs: number;
}

@Injectable()
export class AiLimitsService {
  private readonly maxPendingJobs: number;
  private readonly maxDailyTokens: number;
  private readonly maxDailyRequests: number;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<Record<string, unknown>>,
    private readonly config: ConfigService,
  ) {
    this.maxPendingJobs = Number(
      this.config.get<string>('AI_MAX_PENDING_JOBS_PER_USER') ?? 2,
    );
    this.maxDailyTokens = Number(
      this.config.get<string>('AI_MAX_DAILY_TOKENS_PER_USER') ?? 50000,
    );
    this.maxDailyRequests = Number(
      this.config.get<string>('AI_MAX_DAILY_REQUESTS_PER_USER') ?? 25,
    );
  }

  async checkUserCanSubmitJob(
    executor: NodePgDatabase<Record<string, unknown>> = this.db,
    userId: string,
  ): Promise<void> {
    // 1. Check pending/processing cap
    const activeJobsResult = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(aiGenerationJobs)
      .where(
        and(
          eq(aiGenerationJobs.userId, userId),
          inArray(aiGenerationJobs.status, ['pending', 'processing']),
        ),
      );

    const activeCount = Number(activeJobsResult[0]?.count ?? 0);
    if (activeCount >= this.maxPendingJobs) {
      throw new HttpException(
        `Active generation cap reached. You have ${activeCount} pending or running jobs (max allowed: ${this.maxPendingJobs}).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Check 24-hour daily quota
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usageResult = await executor
      .select({
        totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)::int`,
        requestCount: sql<number>`count(*)::int`,
      })
      .from(aiUsage)
      .where(
        and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, windowStart)),
      );

    const usedTokens = Number(usageResult[0]?.totalTokens ?? 0);
    const requestsUsed = Number(usageResult[0]?.requestCount ?? 0);

    if (usedTokens >= this.maxDailyTokens) {
      throw new HttpException(
        `Daily AI token quota reached (${usedTokens}/${this.maxDailyTokens} tokens). Quota resets continuously over a 24-hour window.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (requestsUsed >= this.maxDailyRequests) {
      throw new HttpException(
        `Daily AI request quota reached (${requestsUsed}/${this.maxDailyRequests} requests). Quota resets continuously over a 24-hour window.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async getQuotaStatus(userId: string): Promise<QuotaStatus> {
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [activeJobsResult, usageResult] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGenerationJobs)
        .where(
          and(
            eq(aiGenerationJobs.userId, userId),
            inArray(aiGenerationJobs.status, ['pending', 'processing']),
          ),
        ),
      this.db
        .select({
          totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)::int`,
          requestCount: sql<number>`count(*)::int`,
        })
        .from(aiUsage)
        .where(
          and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, windowStart)),
        ),
    ]);

    const activeCount = Number(activeJobsResult[0]?.count ?? 0);
    const usedTokens = Number(usageResult[0]?.totalTokens ?? 0);
    const requestsUsed = Number(usageResult[0]?.requestCount ?? 0);

    return {
      usedTokens,
      maxTokens: this.maxDailyTokens,
      requestsUsed,
      maxRequests: this.maxDailyRequests,
      activePendingJobs: activeCount,
      maxPendingJobs: this.maxPendingJobs,
    };
  }
}
