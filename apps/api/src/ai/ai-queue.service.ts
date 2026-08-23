import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { aiGenerationJobs, DeckGenerationPayload } from './schema';
import { CreateAiJobInput } from './dto/create-generation-job.dto';
import { AiLimitsService } from './ai-limits.service';

@Injectable()
export class AiQueueService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<Record<string, unknown>>,
    private readonly limitsService: AiLimitsService,
  ) {}

  async enqueueJob(userId: string, input: CreateAiJobInput) {
    const jobId = randomUUID();
    const payload: DeckGenerationPayload = {
      topic: input.topic,
      sourceText: input.sourceText,
      count: input.count ?? 5,
      model: input.model,
    };

    return await this.db.transaction(async (tx) => {
      // 1. Transaction-scoped advisory lock keyed by user id
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('ai_user_' || ${userId}))`,
      );

      // 2. Check limits inside the locked transaction
      await this.limitsService.checkUserCanSubmitJob(tx, userId);

      // 3. Insert job
      const [job] = await tx
        .insert(aiGenerationJobs)
        .values({
          id: jobId,
          userId,
          type: input.type,
          status: 'pending',
          payload,
          attempts: 0,
          maxAttempts: 3,
        })
        .returning();

      return job;
    });
  }

  async getJobById(userId: string, jobId: string) {
    const [job] = await this.db
      .select()
      .from(aiGenerationJobs)
      .where(eq(aiGenerationJobs.id, jobId));

    if (!job) {
      throw new NotFoundException(`Job with ID "${jobId}" not found`);
    }

    if (job.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this generation job',
      );
    }

    return job;
  }

  async listUserJobs(userId: string, limit = 20) {
    const jobs = await this.db
      .select()
      .from(aiGenerationJobs)
      .where(eq(aiGenerationJobs.userId, userId))
      .orderBy(desc(aiGenerationJobs.createdAt))
      .limit(limit);

    return jobs;
  }
}
