import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import {
  db,
  hasPostgres,
  resetPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './sync/postgres-fixture';
import { AiLimitsService } from '../src/ai/ai-limits.service';
import { AiQueueService } from '../src/ai/ai-queue.service';
import { AiWorkerService } from '../src/ai/ai-worker.service';
import { AiGatewayService } from '../src/ai/ai-gateway.service';
import { aiGenerationJobs, aiUsage } from '../src/ai/schema';
import { MetricsService } from '../src/metrics/metrics.service';
import { userDecks } from '../src/sync/schema';
import { LANGUAGES } from '@repo/schemas';

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('AI Generation Queue & Limits Integration', () => {
  let limitsService: AiLimitsService;
  let queueService: AiQueueService;
  let workerService: AiWorkerService;
  let gatewayService: AiGatewayService;
  let configService: ConfigService;
  let metricsService: MetricsService;

  beforeAll(async () => {
    await setUpPostgres();

    configService = new ConfigService({
      AI_MAX_PENDING_JOBS_PER_USER: '2',
      AI_MAX_DAILY_TOKENS_PER_USER: '50000',
      AI_MAX_DAILY_REQUESTS_PER_USER: '25',
      AI_WORKER_ENABLED: 'false', // driven manually during test
      AI_MOCK: '1',
    });

    metricsService = new MetricsService();
    limitsService = new AiLimitsService(db, configService);
    queueService = new AiQueueService(db, limitsService);
    gatewayService = new AiGatewayService(configService);
    workerService = new AiWorkerService(
      db,
      gatewayService,
      configService,
      metricsService,
    );
  });

  beforeEach(async () => {
    await resetPostgres();
  });

  afterAll(async () => {
    await tearDownPostgres();
  });

  it('enqueues a job and processes it to completion in PostgreSQL', async () => {
    const userId = 'user-a';

    // 1. Check user can submit
    await expect(
      limitsService.checkUserCanSubmitJob(db, userId),
    ).resolves.toBeUndefined();

    // 2. Enqueue topic deck generation
    const job = await queueService.enqueueJob(userId, {
      type: 'topic_deck',
      topic: 'Spanish preterite verbs',
      count: 5,
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('pending');
    expect(job.userId).toBe(userId);

    // 3. Run worker to claim and execute the job
    const processed = await workerService.processNextJob();
    expect(processed).toBe(true);

    // 4. Verify job state in database
    const [completedJob] = await db
      .select()
      .from(aiGenerationJobs)
      .where(eq(aiGenerationJobs.id, job.id));

    expect(completedJob.status).toBe('completed');
    expect(completedJob.result).toBeDefined();
    expect(Array.isArray(completedJob.result)).toBe(true);
    if (!Array.isArray(completedJob.result)) {
      throw new Error('Expected topic deck generation to return a card array');
    }
    expect(completedJob.result.length).toBeGreaterThan(0);
    expect(completedJob.completedAt).not.toBeNull();

    // 5. Verify usage record was written
    const usageRecords = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.userId, userId));

    expect(usageRecords).toHaveLength(1);
    expect(usageRecords[0].jobId).toBe(job.id);
    expect(usageRecords[0].totalTokens).toBeGreaterThan(0);
  });

  it('enforces active pending job cap in PostgreSQL atomically', async () => {
    const userId = 'user-a';

    // Enqueue 2 jobs (max allowed is 2)
    await queueService.enqueueJob(userId, {
      type: 'topic_deck',
      topic: 'Topic 1',
      count: 5,
    });
    await queueService.enqueueJob(userId, {
      type: 'topic_deck',
      topic: 'Topic 2',
      count: 5,
    });

    // 3rd attempt should fail with active cap error
    await expect(
      queueService.enqueueJob(userId, {
        type: 'topic_deck',
        topic: 'Topic 3',
        count: 5,
      }),
    ).rejects.toThrow('Active generation cap reached');

    // Process one job with worker
    await workerService.processNextJob();

    // Now user should be allowed to submit again
    await expect(
      queueService.enqueueJob(userId, {
        type: 'topic_deck',
        topic: 'Topic 3',
        count: 5,
      }),
    ).resolves.toBeDefined();
  });

  it('calculates quota status correctly from PostgreSQL records', async () => {
    const userId = 'user-a';

    const initialQuota = await limitsService.getQuotaStatus(userId);
    expect(initialQuota.usedTokens).toBe(0);
    expect(initialQuota.requestsUsed).toBe(0);
    expect(initialQuota.activePendingJobs).toBe(0);

    // Enqueue and complete a job
    await queueService.enqueueJob(userId, {
      type: 'text_cards',
      sourceText: 'Some biology text for test cards.',
      count: 2,
    });

    await workerService.processNextJob();

    const updatedQuota = await limitsService.getQuotaStatus(userId);
    expect(updatedQuota.usedTokens).toBeGreaterThan(0);
    expect(updatedQuota.requestsUsed).toBe(1);
    expect(updatedQuota.activePendingJobs).toBe(0);
  });

  it('authorizes a word deck and snapshots its language names', async () => {
    const [native, target] = LANGUAGES;
    await db.insert(userDecks).values({
      id: 'word-deck',
      rev: 1,
      userId: 'user-a',
      title: 'Spanish',
      description: null,
      noteType: 'word',
      nativeLanguageId: native.value,
      targetLanguageId: target.value,
      createdAt: 1,
      updatedAt: 1,
    });

    const job = await queueService.enqueueJob('user-a', {
      type: 'word_note',
      deckId: 'word-deck',
      word: 'hola',
      direction: 'target',
    });

    expect(job.payload).toEqual({
      deckId: 'word-deck',
      word: 'hola',
      direction: 'target',
      nativeLanguageId: native.value,
      nativeLanguageName: native.name,
      targetLanguageId: target.value,
      targetLanguageName: target.name,
      model: undefined,
    });

    await expect(workerService.processNextJob()).resolves.toBe(true);
    const [completed] = await db
      .select()
      .from(aiGenerationJobs)
      .where(eq(aiGenerationJobs.id, job.id));
    expect(completed.status).toBe('completed');
    expect(completed.result).toMatchObject({
      noteType: 'word',
      fieldsVersion: 1,
      fields: {
        word: 'hola',
        native_language_id: native.value,
        target_language_id: target.value,
      },
    });
  });

  it('rejects unauthorized or unusable word decks before inserting a job', async () => {
    const [native, target] = LANGUAGES;
    await db.insert(userDecks).values([
      {
        id: 'foreign-word-deck',
        rev: 1,
        userId: 'user-b',
        title: 'Foreign',
        description: null,
        noteType: 'word',
        nativeLanguageId: native.value,
        targetLanguageId: target.value,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'basic-deck',
        rev: 2,
        userId: 'user-a',
        title: 'Basic',
        description: null,
        noteType: 'basic',
        nativeLanguageId: null,
        targetLanguageId: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'deleted-word-deck',
        rev: 3,
        deletedAt: new Date(),
        userId: 'user-a',
        title: 'Deleted',
        description: null,
        noteType: 'word',
        nativeLanguageId: native.value,
        targetLanguageId: target.value,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'unknown-language-deck',
        rev: 4,
        userId: 'user-a',
        title: 'Unknown language',
        description: null,
        noteType: 'word',
        nativeLanguageId: native.value,
        targetLanguageId: '00000000-0000-0000-0000-0000000000ff',
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    for (const deckId of [
      'foreign-word-deck',
      'basic-deck',
      'deleted-word-deck',
      'unknown-language-deck',
    ]) {
      await expect(
        queueService.enqueueJob('user-a', {
          type: 'word_note',
          deckId,
          word: 'hola',
          direction: 'target',
        }),
      ).rejects.toThrow();
    }

    expect(await db.select().from(aiGenerationJobs)).toHaveLength(0);
    expect(await db.select().from(aiUsage)).toHaveLength(0);
  });
});

describePostgres('AI Forced-Failure Integration', () => {
  let limitsService: AiLimitsService;
  let queueService: AiQueueService;
  let workerService: AiWorkerService;
  let gatewayService: AiGatewayService;
  let configService: ConfigService;
  let metricsService: MetricsService;

  beforeAll(async () => {
    await setUpPostgres();

    // Both primary and fallback are unreachable: every attempt fails over
    // once then exhausts all providers, forcing the worker to retry until
    // max attempts is reached.
    configService = new ConfigService({
      AI_MAX_PENDING_JOBS_PER_USER: '2',
      AI_MAX_DAILY_TOKENS_PER_USER: '50000',
      AI_MAX_DAILY_REQUESTS_PER_USER: '25',
      AI_WORKER_ENABLED: 'false',
      AI_MOCK: '',
      AI_API_BASE: 'http://127.0.0.1:1/nonexistent',
      AI_API_KEY: 'unused',
      AI_FALLBACK_API_BASE: 'http://127.0.0.1:1/nonexistent',
      AI_FALLBACK_API_KEY: 'unused',
    });

    metricsService = new MetricsService();
    limitsService = new AiLimitsService(db, configService);
    queueService = new AiQueueService(db, limitsService);
    gatewayService = new AiGatewayService(configService);
    workerService = new AiWorkerService(
      db,
      gatewayService,
      configService,
      metricsService,
    );
  });

  beforeEach(async () => {
    await resetPostgres();
  });

  afterAll(async () => {
    await tearDownPostgres();
  });

  it('retries across profiles and marks the job failed after max attempts', async () => {
    const userId = 'user-a';

    const job = await queueService.enqueueJob(userId, {
      type: 'topic_deck',
      topic: 'forced failure topic',
      count: 5,
    });

    expect(job.status).toBe('pending');

    // Run the worker max_attempts (3) times. Each attempt fails over from
    // primary to fallback, both are unreachable, so each attempt fails.
    // After each failure the worker sets next_run_at into the future
    // (backoff), so force the job due again before the next call.
    for (let i = 0; i < 3; i++) {
      await workerService.processNextJob();
      await db.execute(
        sql`UPDATE ai_generation_jobs SET next_run_at = NOW() WHERE id = ${job.id}`,
      );
    }

    const [failedJob] = await db
      .select()
      .from(aiGenerationJobs)
      .where(eq(aiGenerationJobs.id, job.id));

    expect(failedJob.status).toBe('failed');
    expect(failedJob.error).toBeDefined();
    expect(failedJob.attempts).toBe(3);
  });

  it('records ai_usage per attempt with the serving provider', async () => {
    const userId = 'user-b';

    const job = await queueService.enqueueJob(userId, {
      type: 'topic_deck',
      topic: 'usage tracking topic',
      count: 5,
    });

    for (let i = 0; i < 3; i++) {
      await workerService.processNextJob();
      await db.execute(
        sql`UPDATE ai_generation_jobs SET next_run_at = NOW() WHERE id = ${job.id}`,
      );
    }

    const usageRecords = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.userId, userId))
      .orderBy(aiUsage.createdAt);

    // One usage row per failed attempt (connection errors produce no token
    // usage, but the row is still written with the serving provider).
    expect(usageRecords).toHaveLength(3);
    for (const record of usageRecords) {
      expect(record.jobId).toBe(job.id);
      expect(record.provider).toBeDefined();
      expect(record.totalTokens).toBe(0);
    }
  });
});
