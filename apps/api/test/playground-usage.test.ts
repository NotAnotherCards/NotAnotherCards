import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { sql } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { AiLimitsService } from '../src/ai/ai-limits.service';
import { AiPlaygroundService } from '../src/ai/ai-playground.service';
import { AiGatewayService } from '../src/ai/ai-gateway.service';
import { aiGenerationJobs, aiUsage } from '../src/ai/schema';
import {
  db,
  hasPostgres,
  resetPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './sync/postgres-fixture';

describe.skipIf(!hasPostgres)(
  'playground usage reservations in PostgreSQL',
  () => {
    beforeAll(setUpPostgres, 30_000);
    beforeEach(resetPostgres);
    afterAll(tearDownPostgres, 30_000);
    const limits = () =>
      new AiLimitsService(
        db,
        new ConfigService({ AI_MAX_DAILY_REQUESTS_PER_USER: '1' }),
      );

    it('serializes concurrent requests and updates the single reserved row', async () => {
      const service = limits();
      const attempts = await Promise.allSettled([
        service.reservePlaygroundUsage('user-a', 'gemma4'),
        service.reservePlaygroundUsage('user-a', 'gemma4'),
      ]);
      const accepted = attempts.filter(
        (attempt) => attempt.status === 'fulfilled',
      );
      expect(accepted).toHaveLength(1);
      const rejected = attempts.find(
        (attempt) => attempt.status === 'rejected',
      );
      const reason: unknown = rejected?.reason;
      expect(reason).toBeInstanceOf(HttpException);
      if (!(reason instanceof HttpException))
        throw new Error('Expected quota rejection');
      expect(reason.getStatus()).toBe(429);
      const [reserved] = await db.select().from(aiUsage);
      expect(reserved).toMatchObject({
        userId: 'user-a',
        jobId: null,
        totalTokens: 0,
      });
      if (accepted[0].status !== 'fulfilled')
        throw new Error('Missing accepted reservation');
      await service.completePlaygroundUsage(accepted[0].value, 'served', {
        promptTokens: 2,
        completionTokens: 3,
        totalTokens: 5,
      });
      const rows = await db.select().from(aiUsage);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: reserved.id,
        model: 'served',
        totalTokens: 5,
      });
      expect(await service.getQuotaStatus('user-a')).toMatchObject({
        requestsUsed: 1,
        usedTokens: 5,
      });
    });

    it('keeps failed runs at zero tokens and leaves other accounts independent', async () => {
      const service = limits();
      await service.reservePlaygroundUsage('user-a', 'gemma4');
      await expect(
        service.reservePlaygroundUsage('user-a', 'gemma4'),
      ).rejects.toThrow(HttpException);
      await service.reservePlaygroundUsage('user-b', 'gemma4');
      const rows = await db.select().from(aiUsage);
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.totalTokens === 0)).toBe(true);
    });

    it.each([false, true])(
      'commits history and usage together (usage update fails: %s)',
      async (failUpdate) => {
        // Only this isolated test database has the constraint. Reservations
        // still succeed at zero; finalizing nonzero usage fails in PostgreSQL.
        if (failUpdate)
          await db.execute(sql`
          ALTER TABLE ai_usage ADD CONSTRAINT test_usage_update_failure
          CHECK (total_tokens = 0)
        `);
        try {
          const result = {
            cards: [{ front: 'Hola', back: 'Hello' }],
            usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
            model: 'gemma4',
          };
          const gateway = {
            generateCards: vi
              .fn<AiGatewayService['generateCards']>()
              .mockResolvedValue(result),
          };
          const res = Object.assign(new EventEmitter(), {
            writableEnded: false,
            destroyed: false,
            setHeader: vi.fn(),
            flushHeaders: vi.fn(),
            write: vi.fn().mockReturnValue(true),
            end: vi.fn(),
          });
          const service = new AiPlaygroundService(
            db,
            gateway as unknown as AiGatewayService,
            limits(),
            new ConfigService(),
          );
          await service.stream(
            'user-a',
            { type: 'topic_deck', topic: 'Spanish', count: 1, model: 'gemma4' },
            res as unknown as Response,
          );

          const jobs = await db.select().from(aiGenerationJobs);
          const usageRows = await db.select().from(aiUsage);
          expect(usageRows).toHaveLength(1);
          if (failUpdate) {
            expect(jobs).toEqual([]);
            expect(usageRows[0]).toMatchObject({ jobId: null, totalTokens: 0 });
            expect(res.end).toHaveBeenCalledWith(
              expect.stringContaining('Unable to record generation usage'),
            );
            expect(res.end).not.toHaveBeenCalledWith(
              expect.stringContaining('"type":"result"'),
            );
          } else {
            expect(jobs).toHaveLength(1);
            expect(jobs[0]).toMatchObject({
              status: 'completed',
              result: result.cards,
            });
            expect(usageRows[0]).toMatchObject({
              jobId: jobs[0].id,
              ...result.usage,
            });
            expect(res.end).toHaveBeenCalledWith(
              expect.stringContaining('"type":"result"'),
            );
          }
        } finally {
          if (failUpdate)
            await db.execute(sql`
            ALTER TABLE ai_usage DROP CONSTRAINT test_usage_update_failure
          `);
        }
      },
    );
  },
);
