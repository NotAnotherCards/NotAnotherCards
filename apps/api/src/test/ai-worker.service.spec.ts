import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AiWorkerService } from '../ai/ai-worker.service';
import { AiGatewayService, AiParseError } from '../ai/ai-gateway.service';

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
      execute: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // recovery query
        .mockResolvedValueOnce({ rows: [] }), // dequeue query
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
      model: 'gemma4',
    };

    mockGateway.generateCards.mockResolvedValue(mockInference);

    const mockTxExecute = jest.fn().mockResolvedValue({});
    const mockTxInsert = jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue({}),
    });

    const mockDb = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // recovery query
        .mockResolvedValueOnce({ rows: [mockJob] }), // claim query
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
    // the completion update records the model that answered, so a job
    // that ran on the default still reports it
    expect(mockTxExecute).toHaveBeenCalledTimes(1);
    const [[update]] = mockTxExecute.mock.calls as unknown[][];
    expect(JSON.stringify(update)).toContain('gemma4');
  });

  it('retries job with backoff (status remains pending) if attempt < max_attempts', async () => {
    const mockJob = {
      id: 'job-2',
      user_id: 'user-1',
      type: 'topic_deck',
      payload: { topic: 'Math', count: 2 },
      attempts: 1,
      max_attempts: 3,
    };

    mockGateway.generateCards.mockRejectedValue(
      new Error('Gateway connection timeout'),
    );

    const mockDb = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // recovery query
        .mockResolvedValueOnce({ rows: [mockJob] }) // claim query
        .mockResolvedValueOnce({}), // backoff update query
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(true);
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
  });

  it('marks job as failed when attempts reach max_attempts', async () => {
    const mockJob = {
      id: 'job-3',
      user_id: 'user-1',
      type: 'topic_deck',
      payload: { topic: 'Math', count: 2 },
      attempts: 3,
      max_attempts: 3,
    };

    mockGateway.generateCards.mockRejectedValue(
      new Error('Fatal model parsing failure'),
    );

    const mockDb = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // recovery query
        .mockResolvedValueOnce({ rows: [mockJob] }) // claim query
        .mockResolvedValueOnce({}), // fail update query
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(true);
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
  });

  it('logs token consumption when AiParseError occurs on otherwise valid HTTP response', async () => {
    const mockJob = {
      id: 'job-parse-err',
      user_id: 'user-1',
      type: 'topic_deck',
      payload: { topic: 'Physics', count: 2 },
      attempts: 1,
      max_attempts: 3,
    };

    const parseError = new AiParseError(
      'Malformed card JSON',
      { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
      'qwen',
    );

    mockGateway.generateCards.mockRejectedValue(parseError);

    const mockInsert = jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue({}),
    });

    const mockDb = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockJob] })
        .mockResolvedValueOnce({}),
      insert: mockInsert,
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1); // logs token usage into ai_usage
  });
});
