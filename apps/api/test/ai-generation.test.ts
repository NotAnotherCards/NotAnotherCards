import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
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

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('AI Generation Queue & Limits Integration', () => {
  let limitsService: AiLimitsService;
  let queueService: AiQueueService;
  let workerService: AiWorkerService;
  let gatewayService: AiGatewayService;
  let configService: ConfigService;

  beforeAll(async () => {
    await setUpPostgres();

    configService = new ConfigService({
      AI_MAX_PENDING_JOBS_PER_USER: '2',
      AI_MAX_DAILY_TOKENS_PER_USER: '50000',
      AI_MAX_DAILY_REQUESTS_PER_USER: '25',
      AI_WORKER_ENABLED: 'false', // driven manually during test
      AI_MOCK: '1',
    });

    limitsService = new AiLimitsService(db, configService);
    queueService = new AiQueueService(db, limitsService);
    gatewayService = new AiGatewayService(configService);
    workerService = new AiWorkerService(db, gatewayService, configService);
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
    expect(completedJob.result!.length).toBeGreaterThan(0);
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
});
