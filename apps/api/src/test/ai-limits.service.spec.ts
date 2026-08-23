import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AiLimitsService } from '../ai/ai-limits.service';

describe('AiLimitsService', () => {
  let limitsService: AiLimitsService;
  let mockConfig: ConfigService;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'AI_MAX_PENDING_JOBS_PER_USER') return '2';
        if (key === 'AI_MAX_DAILY_TOKENS_PER_USER') return '1000';
        if (key === 'AI_MAX_DAILY_REQUESTS_PER_USER') return '5';
        return undefined;
      }),
    } as unknown as ConfigService;
  });

  it('allows job submission when within limits', async () => {
    const mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest
            .fn()
            .mockResolvedValue([
              { count: 0, totalTokens: 100, requestCount: 1 },
            ]),
        }),
      }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    limitsService = new AiLimitsService(mockDb, mockConfig);
    await expect(
      limitsService.checkUserCanSubmitJob(mockDb, 'user-1'),
    ).resolves.toBeUndefined();
  });

  it('throws 429 when pending job cap is exceeded', async () => {
    let callIndex = 0;
    const mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(() => {
            callIndex++;
            if (callIndex === 1) {
              return Promise.resolve([{ count: 2 }]);
            }
            return Promise.resolve([{ totalTokens: 0, requestCount: 0 }]);
          }),
        }),
      }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    limitsService = new AiLimitsService(mockDb, mockConfig);

    await expect(
      limitsService.checkUserCanSubmitJob(mockDb, 'user-1'),
    ).rejects.toThrow(HttpException);

    try {
      await limitsService.checkUserCanSubmitJob(mockDb, 'user-1');
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.message).toContain('Active generation cap reached');
      } else {
        throw err;
      }
    }
  });

  it('throws 429 when 24h daily token quota is exceeded', async () => {
    let callIndex = 0;
    const mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(() => {
            callIndex++;
            if (callIndex === 1) {
              return Promise.resolve([{ count: 0 }]);
            }
            return Promise.resolve([{ totalTokens: 1200, requestCount: 2 }]);
          }),
        }),
      }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    limitsService = new AiLimitsService(mockDb, mockConfig);

    try {
      await limitsService.checkUserCanSubmitJob(mockDb, 'user-1');
      throw new Error('Should have thrown');
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.message).toContain('Daily AI token quota reached');
      } else {
        throw err;
      }
    }
  });

  it('throws 429 when 24h daily request quota is exceeded', async () => {
    let callIndex = 0;
    const mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(() => {
            callIndex++;
            if (callIndex === 1) {
              return Promise.resolve([{ count: 0 }]);
            }
            return Promise.resolve([{ totalTokens: 100, requestCount: 5 }]);
          }),
        }),
      }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    limitsService = new AiLimitsService(mockDb, mockConfig);

    try {
      await limitsService.checkUserCanSubmitJob(mockDb, 'user-1');
      throw new Error('Should have thrown');
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.message).toContain('Daily AI request quota reached');
      } else {
        throw err;
      }
    }
  });

  it('returns formatted quota status', async () => {
    let callIndex = 0;
    const mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(() => {
            callIndex++;
            if (callIndex === 1) {
              return Promise.resolve([{ count: 1 }]);
            }
            return Promise.resolve([{ totalTokens: 450, requestCount: 3 }]);
          }),
        }),
      }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;

    limitsService = new AiLimitsService(mockDb, mockConfig);
    const status = await limitsService.getQuotaStatus('user-1');

    expect(status.activePendingJobs).toBe(1);
    expect(status.maxPendingJobs).toBe(2);
    expect(status.usedTokens).toBe(450);
    expect(status.maxTokens).toBe(1000);
    expect(status.requestsUsed).toBe(3);
    expect(status.maxRequests).toBe(5);
  });
});
