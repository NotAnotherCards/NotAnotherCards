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

import { Test } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';
import type { Response } from 'express';
import { AiController } from '../ai/ai.controller';
import { AiPlaygroundService } from '../ai/ai-playground.service';
import { AiGatewayService, AiStreamError } from '../ai/ai-gateway.service';
import { AiLimitsService } from '../ai/ai-limits.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { AiQueueService } from '../ai/ai-queue.service';
import { AuthService } from '../auth/auth.service';

describe('playground streaming HTTP boundary', () => {
  let app: INestApplication<Server>;
  let service: AiPlaygroundService;
  const auth = { userIdFromHeaders: jest.fn() };
  const gateway = {
    generateCards: jest.fn<
      ReturnType<AiGatewayService['generateCards']>,
      Parameters<AiGatewayService['generateCards']>
    >(),
  };
  const limits = {
    reservePlaygroundUsage: jest.fn(),
    completePlaygroundUsage: jest.fn(),
  };
  const jobInsert = jest.fn().mockResolvedValue(undefined);
  const tx = { insert: jest.fn(() => ({ values: jobInsert })) };
  const db = {
    transaction: jest.fn<
      Promise<void>,
      [(executor: typeof tx) => Promise<void>]
    >(),
  };
  const input = {
    type: 'topic_deck',
    topic: 'Spanish',
    count: 1,
    model: 'gemma4',
  };
  const usage = { promptTokens: 2, completionTokens: 3, totalTokens: 5 };
  const result = {
    cards: [{ front: 'Hola', back: 'Hello' }],
    usage,
    model: 'served',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jobInsert.mockResolvedValue(undefined);
    tx.insert.mockImplementation(() => ({ values: jobInsert }));
    db.transaction.mockImplementation((run) => run(tx));
    auth.userIdFromHeaders.mockResolvedValue('user-1');
    limits.reservePlaygroundUsage.mockResolvedValue('usage-1');
    limits.completePlaygroundUsage.mockResolvedValue(undefined);
    gateway.generateCards.mockImplementation(async (_s, _u, _m, _c, stream) => {
      if (!stream) throw new Error('Expected streaming options');
      await stream.onDelta('[{"front":');
      await stream.onDelta('"Hola","back":"Hello"}]');
      return result;
    });
    const module = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        AiPlaygroundService,
        { provide: AuthService, useValue: auth },
        { provide: AiGatewayService, useValue: gateway },
        { provide: AiLimitsService, useValue: limits },
        { provide: AiQueueService, useValue: {} },
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = module.get(AiPlaygroundService);
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('uses SSE headers, ordered deltas, and the existing card result', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/playground/stream')
      .send(input)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(res.headers['cache-control']).toBe('no-cache');
    const events = res.text
      .trim()
      .split('\n\n')
      .map((line: string) => JSON.parse(line.slice(6)) as unknown);
    expect(events).toEqual([
      { type: 'delta', delta: '[{"front":' },
      { type: 'delta', delta: '"Hola","back":"Hello"}]' },
      { type: 'result', cards: result.cards },
    ]);
    expect(limits.reservePlaygroundUsage).toHaveBeenCalledWith(
      'user-1',
      'gemma4',
    );
    expect(limits.completePlaygroundUsage).toHaveBeenCalledTimes(1);
    expect(limits.completePlaygroundUsage).toHaveBeenCalledWith(
      'usage-1',
      'served',
      usage,
      expect.any(String),
      tx,
    );
    // the run lands in history as a job born completed
    expect(jobInsert).toHaveBeenCalledTimes(1);
    expect(jobInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'topic_deck',
        status: 'completed',
        result: result.cards,
        error: null,
        payload: { topic: 'Spanish', count: 1, model: 'served' },
      }),
    );
    const [{ id: jobId }] = jobInsert.mock.calls[0] as [{ id: string }];
    expect(limits.completePlaygroundUsage).toHaveBeenCalledWith(
      'usage-1',
      'served',
      usage,
      jobId,
      tx,
    );
  });

  it('returns HTTP 429 before any gateway call', async () => {
    limits.reservePlaygroundUsage.mockRejectedValue(
      new HttpException('quota exhausted', HttpStatus.TOO_MANY_REQUESTS),
    );
    await request(app.getHttpServer())
      .post('/api/ai/playground/stream')
      .send(input)
      .expect(429);
    expect(gateway.generateCards).not.toHaveBeenCalled();
    expect(limits.completePlaygroundUsage).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and non-topic requests before reserving usage', async () => {
    auth.userIdFromHeaders.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .post('/api/ai/playground/stream')
      .send(input)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/ai/playground/stream')
      .send({ type: 'text_cards', sourceText: 'text' })
      .expect(400);
    expect(limits.reservePlaygroundUsage).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'finalizes usage on generation failure (usage received: %s)',
    async (knownUsage) => {
      gateway.generateCards.mockImplementation(
        async (_s, _u, _m, _c, stream) => {
          if (!stream) throw new Error('Expected streaming options');
          await stream.onDelta('partial');
          throw knownUsage
            ? new AiStreamError('connection failed', usage, 'served')
            : new Error('connection failed');
        },
      );
      const res = await request(app.getHttpServer())
        .post('/api/ai/playground/stream')
        .send(input)
        .expect(200);
      expect(res.text).toContain('"type":"error"');
      expect(res.text).not.toContain('"type":"result"');
      expect(limits.completePlaygroundUsage).toHaveBeenCalledTimes(1);
      expect(limits.completePlaygroundUsage).toHaveBeenCalledWith(
        'usage-1',
        knownUsage ? 'served' : 'gemma4',
        knownUsage
          ? usage
          : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        expect.any(String),
        tx,
      );
      expect(jobInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', result: null }),
      );
    },
  );

  it('never sends success if accounting fails', async () => {
    limits.completePlaygroundUsage.mockRejectedValue(
      new Error('database down'),
    );
    const res = await request(app.getHttpServer())
      .post('/api/ai/playground/stream')
      .send(input)
      .expect(200);
    expect(res.text).toContain('Unable to record generation usage');
    expect(res.text).not.toContain('"type":"result"');
  });

  const response = () =>
    Object.assign(new EventEmitter(), {
      writableEnded: false,
      destroyed: false,
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn().mockReturnValue(true),
      end: jest.fn(),
    });

  it.each(['reservation', 'generation', 'finalization'] as const)(
    'does not send success when the deadline expires during %s',
    async (phase) => {
      const timeout = new AbortController();
      const createTimeout = jest
        .spyOn(AbortSignal, 'timeout')
        .mockReturnValueOnce(timeout.signal);
      const expire = () =>
        timeout.abort(new DOMException('Timed out', 'TimeoutError'));
      if (phase === 'reservation') {
        limits.reservePlaygroundUsage.mockImplementation(() => {
          expire();
          return Promise.resolve('usage-1');
        });
      } else if (phase === 'generation') {
        gateway.generateCards.mockImplementation(() => {
          expire();
          return Promise.resolve(result);
        });
      } else {
        limits.completePlaygroundUsage.mockImplementation(() => {
          expire();
          return Promise.resolve();
        });
      }

      const res = response();
      await service.stream(
        'user-1',
        { ...input, type: 'topic_deck', model: 'gemma4' },
        res as unknown as Response,
      );
      expect(createTimeout.mock.invocationCallOrder[0]).toBeLessThan(
        limits.reservePlaygroundUsage.mock.invocationCallOrder[0],
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(res.end).toHaveBeenCalledWith(
        expect.stringContaining('timed out'),
      );
      expect(res.end).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"result"'),
      );
      expect(limits.completePlaygroundUsage).toHaveBeenCalledWith(
        'usage-1',
        phase === 'reservation' ? 'gemma4' : 'served',
        phase === 'reservation'
          ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          : usage,
        expect.any(String),
        tx,
      );
      if (phase === 'reservation')
        expect(gateway.generateCards).not.toHaveBeenCalled();
      expect(res.listenerCount('close')).toBe(0);
    },
  );

  it('times out while waiting for a slow browser to drain', async () => {
    const res = response();
    res.write.mockReturnValue(false);
    const timed = new AiPlaygroundService(
      db as unknown as ConstructorParameters<typeof AiPlaygroundService>[0],
      gateway as unknown as AiGatewayService,
      limits as unknown as AiLimitsService,
      new ConfigService({ AI_REQUEST_TIMEOUT_MS: '20' }),
    );
    await timed.stream(
      'user-1',
      { ...input, type: 'topic_deck', model: 'gemma4' },
      res as unknown as Response,
    );
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    expect(limits.completePlaygroundUsage).toHaveBeenCalledTimes(1);
    expect(res.listenerCount('drain')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('sends deltas immediately but waits for accounting before the result', async () => {
    const res = response();
    let release!: () => void;
    let called!: () => void;
    const accountingStarted = new Promise<void>((resolve) => {
      called = resolve;
    });
    limits.completePlaygroundUsage.mockImplementation(() => {
      called();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const run = service.stream(
      'user-1',
      { ...input, type: 'topic_deck', model: 'gemma4' },
      res as unknown as Response,
    );
    await accountingStarted;
    expect(res.write).toHaveBeenCalledTimes(2);
    expect(res.end).not.toHaveBeenCalled();
    release();
    await run;
    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('"type":"result"'),
    );
  });

  it('aborts generation when the browser closes the connection', async () => {
    const res = response();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let signal!: AbortSignal;
    gateway.generateCards.mockImplementation((_s, _u, _m, _c, stream) => {
      if (!stream?.signal) throw new Error('Expected streaming abort signal');
      signal = stream.signal;
      started();
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new Error('Request aborted')),
          {
            once: true,
          },
        );
      });
    });
    const run = service.stream(
      'user-1',
      { ...input, type: 'topic_deck', model: 'gemma4' },
      res as unknown as Response,
    );
    await ready;
    res.destroyed = true;
    res.emit('close');
    await run;
    expect(signal.aborted).toBe(true);
    expect(limits.completePlaygroundUsage).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
    expect(res.listenerCount('close')).toBe(0);
  });
});
