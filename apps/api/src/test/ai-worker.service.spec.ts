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

    const mockValues = jest.fn().mockResolvedValue({});
    const mockExecute = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // recovery query
      .mockResolvedValueOnce({ rows: [mockJob] }) // claim query
      .mockResolvedValueOnce({}); // completion update
    const mockDb = {
      execute: mockExecute,
      insert: jest.fn().mockReturnValue({ values: mockValues }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    const processed = await workerService.processNextJob();

    expect(processed).toBe(true);
    expect(mockGateway.generateCards).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', totalTokens: 25 }),
    );
    // the completion update records the model that answered, so a job
    // that ran on the default still reports it
    expect(mockExecute).toHaveBeenCalledTimes(3);
    const [, , [update]] = mockExecute.mock.calls as unknown[][];
    expect(JSON.stringify(update)).toContain('gemma4');
  });

  it('keeps the usage row when writing the result fails', async () => {
    // #283: usage and the completion update shared a transaction, so a
    // failed write rolled the usage back and the attempt went unmetered.
    const mockJob = {
      id: 'job-1',
      user_id: 'user-1',
      type: 'topic_deck',
      payload: { topic: 'Biology', count: 2 },
      attempts: 1,
      max_attempts: 3,
    };
    mockGateway.generateCards.mockResolvedValue({
      cards: [{ front: 'Q', back: 'A' }],
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
      model: 'gemma4',
    });
    const mockValues = jest.fn().mockResolvedValue({});
    const mockDb = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // recovery query
        .mockResolvedValueOnce({ rows: [mockJob] }) // claim query
        .mockRejectedValueOnce(new Error('invalid byte sequence')) // completion update
        .mockResolvedValueOnce({}), // backoff update
      insert: jest.fn().mockReturnValue({ values: mockValues }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    const workerService = new AiWorkerService(mockDb, mockGateway, mockConfig);
    await workerService.processNextJob();

    expect(mockValues).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ totalTokens: 25 }),
    );
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

  it('records usage before retrying a response-body timeout', async () => {
    const config = {
      get: (key: string) =>
        key === 'AI_API_BASE' ? 'https://mock-ai.test/v1' : undefined,
    } as ConfigService;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new DOMException('aborted', 'TimeoutError')),
    } as unknown as Response);
    const values = jest.fn().mockResolvedValue({});
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-body-timeout',
            user_id: 'user-1',
            type: 'topic_deck',
            payload: { topic: 'Physics', count: 2 },
            attempts: 1,
            max_attempts: 3,
          },
        ],
      })
      .mockResolvedValueOnce({});
    const db = {
      execute,
      insert: jest.fn().mockReturnValue({ values }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;
    try {
      const worker = new AiWorkerService(
        db,
        new AiGatewayService(config),
        mockConfig,
      );
      expect(await worker.processNextJob()).toBe(true);
      expect(values).toHaveBeenCalledTimes(1);
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-body-timeout',
          userId: 'user-1',
          completionTokens: 4096,
          totalTokens: expect.any(Number) as number,
        }),
      );
      expect(execute).toHaveBeenCalledTimes(3);
      expect(JSON.stringify(execute.mock.calls[2])).toContain(
        "status = 'pending'",
      );
      expect(values.mock.invocationCallOrder[0]).toBeLessThan(
        execute.mock.invocationCallOrder[2],
      );
    } finally {
      fetchMock.mockRestore();
    }
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
