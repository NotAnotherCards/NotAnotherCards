import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { aiGenerationJobs, type GenerationPayload } from './schema';
import { CreateAiJobInput } from './dto/create-generation-job.dto';
import { AiLimitsService } from './ai-limits.service';
import { userDecks } from '../sync/schema';
import { WORD_NOTE_TYPE } from '@repo/offline-db';
import { languageFor } from '@repo/schemas';

@Injectable()
export class AiQueueService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<Record<string, unknown>>,
    private readonly limitsService: AiLimitsService,
  ) {}

  async enqueueJob(userId: string, input: CreateAiJobInput) {
    const jobId = randomUUID();

    return await this.db.transaction(async (tx) => {
      // 1. Transaction-scoped advisory lock keyed by user id
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('ai_user_' || ${userId}))`,
      );

      let payload: GenerationPayload;
      if (input.type === 'word_note') {
        const [deck] = await tx
          .select({
            noteType: userDecks.noteType,
            nativeLanguageId: userDecks.nativeLanguageId,
            targetLanguageId: userDecks.targetLanguageId,
          })
          .from(userDecks)
          .where(
            and(
              eq(userDecks.id, input.deckId),
              eq(userDecks.userId, userId),
              isNull(userDecks.deletedAt),
            ),
          )
          .limit(1);
        if (!deck) throw new NotFoundException('Word deck not found');
        if (deck.noteType !== WORD_NOTE_TYPE) {
          throw new BadRequestException('AI word notes require a word deck');
        }
        const nativeLanguage = languageFor(deck.nativeLanguageId);
        const targetLanguage = languageFor(deck.targetLanguageId);
        if (!nativeLanguage || !targetLanguage) {
          throw new BadRequestException(
            'Word deck languages are not supported',
          );
        }
        payload = {
          deckId: input.deckId,
          word: input.word,
          direction: input.direction,
          nativeLanguageId: nativeLanguage.value,
          nativeLanguageName: nativeLanguage.name,
          targetLanguageId: targetLanguage.value,
          targetLanguageName: targetLanguage.name,
          model: input.model,
        };
      } else if (input.type === 'topic_deck') {
        payload = {
          topic: input.topic,
          count: input.count,
          model: input.model,
        };
      } else {
        payload = {
          sourceText: input.sourceText,
          count: input.count,
          model: input.model,
        };
      }

      // 2. Check limits inside the locked transaction, after authorization
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
