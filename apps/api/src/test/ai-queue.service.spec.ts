import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AiQueueService } from '../ai/ai-queue.service';

describe('AiQueueService', () => {
  let queueService: AiQueueService;
  let mockDb: {
    insert: jest.Mock;
    select: jest.Mock;
  };

  beforeEach(() => {
    mockDb = {
      insert: jest.fn(),
      select: jest.fn(),
    };
    queueService = new AiQueueService(
      mockDb as unknown as NodePgDatabase<Record<string, unknown>>,
    );
  });

  it('enqueues a generation job', async () => {
    const mockCreatedJob = {
      id: 'job-123',
      userId: 'user-1',
      type: 'topic_deck',
      status: 'pending',
      payload: {
        topic: 'Spanish',
        count: 5,
        promptVersion: 'v1',
      },
    };

    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockCreatedJob]),
      }),
    });

    const job = await queueService.enqueueJob('user-1', {
      type: 'topic_deck',
      topic: 'Spanish',
      count: 5,
      promptVersion: 'v1',
    });

    expect(job).toEqual(mockCreatedJob);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('retrieves an existing job if user owns it', async () => {
    const mockJob = {
      id: 'job-123',
      userId: 'user-1',
      status: 'completed',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockJob]),
      }),
    });

    const result = await queueService.getJobById('user-1', 'job-123');
    expect(result).toEqual(mockJob);
  });

  it('throws NotFoundException if job does not exist', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    await expect(
      queueService.getJobById('user-1', 'nonexistent-job'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException if job belongs to different user', async () => {
    const mockJob = {
      id: 'job-123',
      userId: 'other-user',
      status: 'completed',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockJob]),
      }),
    });

    await expect(queueService.getJobById('user-1', 'job-123')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lists user jobs ordered by creation', async () => {
    const mockJobs = [
      { id: 'job-1', userId: 'user-1' },
      { id: 'job-2', userId: 'user-1' },
    ];

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockJobs),
          }),
        }),
      }),
    });

    const jobs = await queueService.listUserJobs('user-1', 10);
    expect(jobs).toEqual(mockJobs);
  });
});
