import { ConfigService } from '@nestjs/config';
import { AiGatewayService } from '../ai/ai-gateway.service';

describe('AiGatewayService', () => {
  let service: AiGatewayService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
    service = new AiGatewayService(configService);
  });

  it('generates mock cards when AI_API_BASE is unset', async () => {
    const result = await service.generateCards(
      'System prompt',
      'Generate Spanish cards',
    );

    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].front).toBeDefined();
    expect(result.cards[0].back).toBeDefined();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.model).toContain('mock');
  });

  it('parses valid JSON response from remote gateway', async () => {
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

    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'AI_API_BASE') return 'https://mock-ai.test/v1';
        if (key === 'AI_DEFAULT_MODEL') return 'qwen';
        return undefined;
      }),
    } as unknown as ConfigService;

    const gatewayWithConfig = new AiGatewayService(mockConfig);
    const result = await gatewayWithConfig.generateCards(
      'sys',
      'user',
      'custom-model',
    );

    expect(result.cards).toEqual([
      { front: 'Hola', back: 'Hello' },
      { front: 'Adios', back: 'Goodbye' },
    ]);
    expect(result.usage.totalTokens).toBe(40);
    expect(result.model).toBe('custom-model');
  });

  it('strips <think> tags before parsing JSON', async () => {
    const rawContent =
      '<think>Let me formulate 1 card.\nFront: Question, Back: Answer.</think>\n' +
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

    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'AI_API_BASE') return 'https://mock-ai.test/v1';
        return undefined;
      }),
    } as unknown as ConfigService;

    const gatewayWithConfig = new AiGatewayService(mockConfig);
    const result = await gatewayWithConfig.generateCards('sys', 'user');

    expect(result.cards).toEqual([{ front: 'Question 1', back: 'Answer 1' }]);
  });

  it('throws an error when JSON parsing fails', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Sorry, I cannot generate that.' } }],
        }),
    });
    global.fetch = mockFetch;

    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'AI_API_BASE') return 'https://mock-ai.test/v1';
        return undefined;
      }),
    } as unknown as ConfigService;

    const gatewayWithConfig = new AiGatewayService(mockConfig);
    await expect(
      gatewayWithConfig.generateCards('sys', 'user'),
    ).rejects.toThrow('did not contain a valid JSON array');
  });
});
