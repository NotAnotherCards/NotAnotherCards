import { ConfigService } from '@nestjs/config';
import { AiGatewayService, AiParseError } from '../ai/ai-gateway.service';

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

  describe('accounting for failed requests (#283)', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'AI_API_BASE' ? 'https://mock-ai.test/v1' : undefined,
      ),
    } as unknown as ConfigService;
    const generate = () =>
      new AiGatewayService(config).generateCards('sys', 'user prompt');

    it('charges a bounded usage when the request times out', async () => {
      // the gateway has generated and billed by the time our abort fires
      global.fetch = jest
        .fn()
        .mockRejectedValue(new DOMException('aborted', 'TimeoutError'));
      await expect(generate()).rejects.toMatchObject({
        name: 'AiParseError',
        usage: { completionTokens: 4096 },
      });
      const err = (await generate().catch((e: unknown) => e)) as AiParseError;
      expect(err.usage.promptTokens).toBeGreaterThan(0);
      expect(err.usage.totalTokens).toBe(
        err.usage.promptTokens + err.usage.completionTokens,
      );
    });

    it.each(['TimeoutError', 'AbortError'])(
      'charges usage when reading the response body times out with %s',
      async (name) => {
        const controller = new AbortController();
        const timeout = jest
          .spyOn(AbortSignal, 'timeout')
          .mockReturnValue(controller.signal);
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => {
            controller.abort(new DOMException('timed out', 'TimeoutError'));
            return Promise.reject(new DOMException('aborted', name));
          },
        });
        try {
          await expect(generate()).rejects.toMatchObject({
            name: 'AiParseError',
            model: 'gemma4',
            usage: {
              promptTokens: 30,
              completionTokens: 4096,
              totalTokens: 4126,
            },
          });
        } finally {
          timeout.mockRestore();
        }
      },
    );

    it('does not charge when an error response body times out', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.reject(new DOMException('aborted', 'TimeoutError')),
      });
      const err = await generate().catch((e: unknown) => e);
      expect(err).not.toBeInstanceOf(AiParseError);
    });

    it('does not charge a refused connection', async () => {
      // nothing reached the model; a down gateway must not drain quota
      global.fetch = jest
        .fn()
        .mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));
      const err = (await generate().catch((e: unknown) => e)) as Error;
      expect(err).not.toBeInstanceOf(AiParseError);
      expect(err.message).toContain('ECONNREFUSED');
    });

    it('does not charge a gateway error status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('unavailable'),
      });
      const err = (await generate().catch((e: unknown) => e)) as Error;
      expect(err).not.toBeInstanceOf(AiParseError);
      expect(err.message).toContain('503');
    });

    it('sends max_tokens so the completion bound is real', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '[{"front":"Q","back":"A"}]' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
      });
      global.fetch = mockFetch;
      await generate();
      const [[, init]] = mockFetch.mock.calls as [string, RequestInit][];
      expect(JSON.parse(init.body as string)).toMatchObject({
        max_tokens: 4096,
      });
    });
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
});
