jest.mock('better-auth', () => ({
  betterAuth: jest.fn(() => ({
    api: { getSession: jest.fn() },
  })),
}));
jest.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: jest.fn(),
}));
jest.mock('@better-auth/expo', () => ({
  expo: jest.fn(),
}));
jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn(),
  toNodeHandler: jest.fn(),
}));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AiController } from '../ai/ai.controller';
import { AuthService } from '../auth/auth.service';
import { AiLimitsService } from '../ai/ai-limits.service';
import { AiQueueService } from '../ai/ai-queue.service';

describe('AiController', () => {
  let controller: AiController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockLimitsService: jest.Mocked<AiLimitsService>;
  let mockQueueService: jest.Mocked<AiQueueService>;

  beforeEach(() => {
    mockAuthService = {
      userIdFromHeaders: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    mockLimitsService = {
      checkUserCanSubmitJob: jest.fn(),
      getQuotaStatus: jest.fn(),
    } as unknown as jest.Mocked<AiLimitsService>;

    mockQueueService = {
      enqueueJob: jest.fn(),
      getJobById: jest.fn(),
      listUserJobs: jest.fn(),
    } as unknown as jest.Mocked<AiQueueService>;

    controller = new AiController(
      mockAuthService,
      mockLimitsService,
      mockQueueService,
    );
  });

  it('rejects unauthenticated requests with UnauthorizedException', async () => {
    mockAuthService.userIdFromHeaders.mockResolvedValue(null);

    const mockReq = { headers: {} } as unknown as Request;
    await expect(
      controller.createGenerationJob(mockReq, {
        type: 'topic_deck',
        topic: 'Test',
        count: 5,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid payload with BadRequestException', async () => {
    mockAuthService.userIdFromHeaders.mockResolvedValue('user-1');

    const mockReq = { headers: {} } as unknown as Request;
    // Missing 'topic' for topic_deck type
    await expect(
      controller.createGenerationJob(mockReq, {
        type: 'topic_deck',
        count: 5,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates generation job successfully when valid', async () => {
    mockAuthService.userIdFromHeaders.mockResolvedValue('user-1');
    const mockJob = {
      id: 'job-1',
      userId: 'user-1',
      status: 'pending' as const,
      type: 'topic_deck' as const,
      payload: { topic: 'Spanish', count: 5, promptVersion: 'v1' },
      result: null,
      error: null,
      attempts: 0,
      maxAttempts: 3,
      lockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    mockQueueService.enqueueJob.mockResolvedValue(mockJob);

    const mockReq = { headers: {} } as unknown as Request;
    const result = await controller.createGenerationJob(mockReq, {
      type: 'topic_deck',
      topic: 'Spanish',
      count: 5,
    });

    expect(mockLimitsService.checkUserCanSubmitJob).toHaveBeenCalledWith(
      'user-1',
    );
    expect(mockQueueService.enqueueJob).toHaveBeenCalledWith('user-1', {
      type: 'topic_deck',
      topic: 'Spanish',
      count: 5,
      promptVersion: 'v1',
    });
    expect(result).toEqual({ job: mockJob });
  });

  it('retrieves job by ID', async () => {
    mockAuthService.userIdFromHeaders.mockResolvedValue('user-1');
    const mockJob = {
      id: 'job-1',
      userId: 'user-1',
      status: 'completed' as const,
      type: 'topic_deck' as const,
      payload: { topic: 'Spanish', count: 5, promptVersion: 'v1' },
      result: null,
      error: null,
      attempts: 1,
      maxAttempts: 3,
      lockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    };
    mockQueueService.getJobById.mockResolvedValue(mockJob);

    const mockReq = { headers: {} } as unknown as Request;
    const result = await controller.getJobById(mockReq, 'job-1');

    expect(mockQueueService.getJobById).toHaveBeenCalledWith('user-1', 'job-1');
    expect(result).toEqual({ job: mockJob });
  });

  it('lists user jobs', async () => {
    mockAuthService.userIdFromHeaders.mockResolvedValue('user-1');
    const mockJobs = [
      {
        id: 'job-1',
        userId: 'user-1',
        status: 'completed' as const,
        type: 'topic_deck' as const,
        payload: { topic: 'Spanish', count: 5, promptVersion: 'v1' },
        result: null,
        error: null,
        attempts: 1,
        maxAttempts: 3,
        lockedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      },
    ];
    mockQueueService.listUserJobs.mockResolvedValue(mockJobs);

    const mockReq = { headers: {} } as unknown as Request;
    const result = await controller.listJobs(mockReq);

    expect(mockQueueService.listUserJobs).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ jobs: mockJobs });
  });

  it('retrieves quota status', async () => {
    mockAuthService.userIdFromHeaders.mockResolvedValue('user-1');
    const mockQuota = {
      usedTokens: 100,
      maxTokens: 50000,
      requestsUsed: 2,
      maxRequests: 25,
      activePendingJobs: 0,
      maxPendingJobs: 2,
      resetAt: '2026-08-22T00:00:00.000Z',
    };
    mockLimitsService.getQuotaStatus.mockResolvedValue(mockQuota);

    const mockReq = { headers: {} } as unknown as Request;
    const result = await controller.getQuota(mockReq);

    expect(mockLimitsService.getQuotaStatus).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ quota: mockQuota });
  });
});
