import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { AiLimitsService } from '../src/ai/ai-limits.service';
import { aiUsage } from '../src/ai/schema';
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
  },
);
