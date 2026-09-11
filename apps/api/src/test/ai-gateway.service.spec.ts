import { ConfigService } from '@nestjs/config';
import {
  AiGatewayService,
  AiParseError,
  AiStreamError,
  sseData,
} from '../ai/ai-gateway.service';

describe('AiGatewayService', () => {
  let service: AiGatewayService;
  let mockConfig: ConfigService;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'AI_MOCK') return '1';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new AiGatewayService(mockConfig);
  });

  it('generates mock cards when AI_MOCK=1 is active', async () => {
    const result = await service.generateCards(
      'System prompt',
      'Generate Spanish cards',
      'qwen',
      3,
    );

    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].front).toBeDefined();
    expect(result.cards[0].back).toBeDefined();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.model).toContain('mock');
  });

  it('generates a mock object when AI_MOCK=1 is active', async () => {
    const result = await service.generateObject('System prompt', 'One word');

    expect(typeof result.value.word).toBe('string');
    expect(typeof result.value.translation).toBe('string');
    expect(typeof result.value.pronunciation).toBe('string');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.model).toContain('mock');
  });

  it('throws when AI_API_BASE is unset and AI_MOCK is not enabled', async () => {
    const unconfiguredConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const gateway = new AiGatewayService(unconfiguredConfig);
      await expect(gateway.generateCards('sys', 'user')).rejects.toThrow(
        'AI gateway is not configured',
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('parses valid JSON response from remote gateway and clamps card count', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { front: 'Hola', back: 'Hello' },
                  { front: 'Adios', back: 'Goodbye' },
                  { front: 'Gracias', back: 'Thank you' },
                ]),
              },
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 25,
            total_tokens: 40,
          },
        }),
    });
    global.fetch = mockFetch;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_API_BASE') return 'https://mock-ai.test/v1';
        if (key === 'AI_DEFAULT_MODEL') return 'qwen';
        return undefined;
      }),
    } as unknown as ConfigService;

    const gateway = new AiGatewayService(config);
    // Request only 2 cards
    const result = await gateway.generateCards(
      'sys',
      'user',
      'mistral-small',
      2,
    );

    expect(result.cards).toEqual([
      { front: 'Hola', back: 'Hello' },
      { front: 'Adios', back: 'Goodbye' },
    ]);
    expect(result.usage.totalTokens).toBe(40);
    expect(result.model).toBe('mistral-small');

    // Reasoning must be off: with it, a five-card job runs into the 60s
    // request timeout (measured 26-56s vs ~3s without).
    const fetchCalls = mockFetch.mock.calls as [string, RequestInit][];
    const sentBody = JSON.parse(fetchCalls[0][1].body as string) as Record<
      string,
      unknown
    >;
    expect(sentBody.reasoning_effort).toBe('none');
  });

  it('tolerates a trailing slash in AI_API_BASE', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify([{ front: 'Hola', back: 'Hello' }]),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
    });
    global.fetch = mockFetch;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_API_BASE') return 'https://mock-ai.test/v1/';
        return undefined;
      }),
    } as unknown as ConfigService;

    await new AiGatewayService(config).generateCards('sys', 'user', 'qwen', 1);

    const fetchCalls = mockFetch.mock.calls as [string, RequestInit][];
    expect(fetchCalls[0][0]).toBe('https://mock-ai.test/v1/chat/completions');
  });

  it('strips <think> tags before parsing JSON', async () => {
    const rawContent =
      '<think>Let me reason about 1 card.\nFront: Question, Back: Answer.</think>\n' +
      '[{"front": "Question 1", "back": "Answer 1"}]';

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: rawContent } }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
    });
    global.fetch = mockFetch;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_API_BASE') return 'https://mock-ai.test/v1';
        return undefined;
      }),
    } as unknown as ConfigService;

    const gateway = new AiGatewayService(config);
    const result = await gateway.generateCards('sys', 'user');

    expect(result.cards).toEqual([{ front: 'Question 1', back: 'Answer 1' }]);
  });

  it('extracts one JSON object from thinking and prose', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content:
                  '<think>work it out</think>Here is the note:\n' +
                  '{"word":"Hund","translation":"dog"}\nDone.',
              },
            },
          ],
          usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
        }),
    });
    const config = {
      get: jest.fn((key: string) =>
        key === 'AI_API_BASE' ? 'https://mock-ai.test/v1' : undefined,
      ),
    } as unknown as ConfigService;

    const result = await new AiGatewayService(config).generateObject(
      'sys',
      'user',
    );

    expect(result.value).toEqual({ word: 'Hund', translation: 'dog' });
    expect(result.usage.totalTokens).toBe(7);
  });

  it('throws AiParseError with usage when JSON parsing fails on valid HTTP response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Sorry, I cannot generate that.' } }],
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        }),
    });
    global.fetch = mockFetch;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_API_BASE') return 'https://mock-ai.test/v1';
        return undefined;
      }),
    } as unknown as ConfigService;

    const gateway = new AiGatewayService(config);
    try {
      await gateway.generateCards('sys', 'user');
      throw new Error('Should have failed');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AiParseError);
      if (err instanceof AiParseError) {
        expect(err.usage.totalTokens).toBe(20);
      }
    }
  });

  it('reports the model the gateway answered with, not the requested alias', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model: 'qwen3.6',
          choices: [
            {
              message: {
                content: JSON.stringify([{ front: 'Hola', back: 'Hello' }]),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
    });
    const config = {
      get: jest.fn((key: string) =>
        key === 'AI_API_BASE' ? 'https://mock-ai.test/v1' : undefined,
      ),
    } as unknown as ConfigService;

    const result = await new AiGatewayService(config).generateCards(
      'sys',
      'user',
      'gemma4',
      1,
    );

    expect(result.model).toBe('qwen3.6');
  });

  describe('streaming through generateCards', () => {
    const event = (value: unknown) => 'data: ' + JSON.stringify(value) + '\n\n';
    const usageEvent = event({
      model: 'served',
      choices: [],
      usage: {
        prompt_tokens: 2,
        completion_tokens: 3,
        total_tokens: 5,
      },
    });
    const gateway = (timeout = '1000') =>
      new AiGatewayService({
        get: (key: string) =>
          key === 'AI_API_BASE'
            ? 'https://gateway.test/v1'
            : key === 'AI_REQUEST_TIMEOUT_MS'
              ? timeout
              : undefined,
      } as ConfigService);
    const body = (parts: Uint8Array[]) =>
      new ReadableStream<Uint8Array>({
        pull(controller) {
          const part = parts.shift();
          if (part) controller.enqueue(part);
          else controller.close();
        },
      });

    it('streams split UTF-8 and returns exactly the buffered parser result', async () => {
      const raw =
        '<think>[ignore]</think>Cards: ' +
        JSON.stringify([
          { front: 'café', back: 'x'.repeat(1100) },
          { front: 'extra', back: 'not requested' },
        ]);
      const wire =
        event({ choices: [{ delta: { content: raw } }] }) +
        usageEvent +
        'data: [DONE]\n\n';
      const bytes = new TextEncoder().encode(wire);
      const cut = bytes.indexOf(0xc3) + 1;
      const fetchMock = jest
        .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
        .mockResolvedValueOnce(
          new Response(body([bytes.slice(0, cut), bytes.slice(cut)])),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              model: 'served',
              choices: [{ message: { content: raw } }],
              usage: {
                prompt_tokens: 2,
                completion_tokens: 3,
                total_tokens: 5,
              },
            }),
          ),
        );
      global.fetch = fetchMock;
      const pieces: string[] = [];
      const streamed = await gateway().generateCards(
        'sys',
        'topic',
        undefined,
        1,
        {
          onDelta: (delta) => {
            pieces.push(delta);
          },
        },
      );
      const buffered = await gateway().generateCards(
        'sys',
        'topic',
        undefined,
        1,
      );
      expect(pieces.join('')).toBe(raw);
      expect(streamed).toEqual(buffered);
      expect(streamed.cards).toEqual([
        { front: 'café', back: 'x'.repeat(1000) },
      ]);
      const init = fetchMock.mock.calls[0][1]!;
      expect(JSON.parse(init.body as string)).toMatchObject({
        stream: true,
        stream_options: { include_usage: true },
      });
    });

    it('keeps usage when the body ends without DONE', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response(usageEvent));
      await expect(
        gateway().generateCards('sys', 'topic', undefined, 1, {
          onDelta: () => {},
        }),
      ).rejects.toMatchObject({
        name: 'AiStreamError',
        message: 'AI stream ended before [DONE]',
        model: 'served',
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
      });
    });

    it('keeps usage on invalid generated cards', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          new Response(
            event({ choices: [{ delta: { content: 'not cards' } }] }) +
              usageEvent +
              'data: [DONE]\n\n',
          ),
        );
      await expect(
        gateway().generateCards('sys', 'topic', undefined, 1, {
          onDelta: () => {},
        }),
      ).rejects.toBeInstanceOf(AiParseError);
    });

    it('surfaces an upstream error and cancels its reader', async () => {
      const cancel = jest.fn();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              event({ error: { message: 'provider failed' } }),
            ),
          );
        },
        cancel,
      });
      global.fetch = jest.fn().mockResolvedValue(new Response(stream));
      await expect(
        gateway().generateCards('sys', 'topic', undefined, 1, {
          onDelta: () => {},
        }),
      ).rejects.toThrow('provider failed');
      expect(cancel).toHaveBeenCalled();
      expect(stream.locked).toBe(false);
    });

    it('aborts a stalled streamed body on timeout', async () => {
      global.fetch = jest
        .fn()
        .mockImplementation((_url: string, init: RequestInit) =>
          Promise.resolve(
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  init.signal!.addEventListener(
                    'abort',
                    () => controller.error(init.signal!.reason),
                    { once: true },
                  );
                },
              }),
            ),
          ),
        );
      await expect(
        gateway('20').generateCards('sys', 'topic', undefined, 1, {
          onDelta: () => {},
        }),
      ).rejects.toBeInstanceOf(AiStreamError);
    });

    it('mock mode streams the same cards and obeys cancellation', async () => {
      const pieces: string[] = [];
      const result = await service.generateCards('sys', 'topic', undefined, 1, {
        onDelta: (delta) => {
          pieces.push(delta);
        },
      });
      expect(pieces.length).toBeGreaterThan(1);
      expect(JSON.parse(pieces.join(''))).toEqual(result.cards);
      const abort = new AbortController();
      abort.abort();
      await expect(
        service.generateCards('sys', 'topic', undefined, 1, {
          signal: abort.signal,
          onDelta: () => {},
        }),
      ).rejects.toThrow();
    });

    it('the SSE reader supports CRLF, comments, and multiple events per chunk', async () => {
      const parts: string[] = [];
      const response = new Response(
        ': comment\r\n\r\ndata: one\r\n\r\ndata: two\r\n\r\ndata: [DONE]\r\n\r\n',
      );
      for await (const data of sseData(response.body!)) parts.push(data);
      expect(parts).toEqual(['one', 'two']);
    });
  });
});
