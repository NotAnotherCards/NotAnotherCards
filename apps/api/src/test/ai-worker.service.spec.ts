import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AiWorkerService } from '../ai/ai-worker.service';
import { AiGatewayService } from '../ai/ai-gateway.service';

describe('AiWorkerService', () => {
  let mockGateway: jest.Mocked<AiGatewayService>;
  let mockConfig: ConfigService;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'AI_WORKER_POLL_INTERVAL_MS') return '5000';
        if (key === 'AI_WORKER_ENABLED') return 'false';
        return undefined;
      }),
    } as unknown as ConfigService;

    mockGateway = {
      generateCards: jest.fn(),
    } as unknown as jest.Mocked<AiGatewayService>;
  });

  it('returns false when no jobs are pending in queue', async () => {
    const mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(false);
    expect(mockGateway.generateCards).toHaveBeenCalledTimes(0);
  });

  it('executes job and marks it completed with usage recorded', async () => {
    const mockJob = {
      id: 'job-1',
      user_id: 'user-1',
      type: 'topic_deck',
      payload: {
        topic: 'Biology',
        count: 2,
        promptVersion: 'v1',
      },
      attempts: 1,
      max_attempts: 3,
    };

    const mockInference = {
      cards: [
        { front: 'What is photosynthesis?', back: 'Plant food process.' },
      ],
      usage: {
        promptTokens: 10,
        completionTokens: 15,
        totalTokens: 25,
      },
      model: 'qwen',
    };

    mockGateway.generateCards.mockResolvedValue(mockInference);

    const mockTxExecute = jest.fn().mockResolvedValue({});
    const mockTxInsert = jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue({}),
    });

    const mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [mockJob] }),
      transaction: jest.fn(
        (
          cb: (tx: {
            execute: jest.Mock;
            insert: jest.Mock;
          }) => Promise<unknown>,
        ) =>
          cb({
            execute: mockTxExecute,
            insert: mockTxInsert,
          }),
      ),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(true);
    expect(mockGateway.generateCards).toHaveBeenCalledTimes(1);
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('retries job (status remains pending) if attempt < max_attempts', async () => {
    const mockJob = {
      id: 'job-2',
      user_id: 'user-1',
      type: 'topic_deck',
      payload: { topic: 'Math', count: 2, promptVersion: 'v1' },
      attempts: 1,
      max_attempts: 3,
    };

    mockGateway.generateCards.mockRejectedValue(
      new Error('Gateway connection timeout'),
    );

    const mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [mockJob] }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(true);
    expect(mockDb.execute).toHaveBeenCalledTimes(2); // 1 to claim, 1 to update on error
  });

  it('marks job as failed when attempts reach max_attempts', async () => {
    const mockJob = {
      id: 'job-3',
      user_id: 'user-1',
      type: 'topic_deck',
      payload: { topic: 'Math', count: 2, promptVersion: 'v1' },
      attempts: 3,
      max_attempts: 3,
    };

    mockGateway.generateCards.mockRejectedValue(
      new Error('Fatal model parsing failure'),
    );

    const mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [mockJob] }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(true);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });
});
