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
});
