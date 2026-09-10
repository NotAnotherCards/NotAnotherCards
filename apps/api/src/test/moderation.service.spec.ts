import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationService } from '../sharing/moderation.service';

describe('ModerationService', () => {
  const cards = [
    { id: 'card-1', front: 'front 1', back: 'back 1' },
    { id: 'card-2', front: 'front 2', back: 'back 2' },
    { id: 'card-3', front: 'front 3', back: 'back 3' },
  ];
  const input = { deckId: 'deck-1', cards };
  const originalFetch = global.fetch;

  const serviceWith = (values: Record<string, string | undefined>) =>
    new ModerationService({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService);

  const response = (content: string) =>
    ({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content } }] }),
    }) as Response;

  const fakeAbortTimeouts = () =>
    jest.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), milliseconds);
      return controller.signal;
    });

  const delayedSafeFetch = (milliseconds: number) =>
    jest.mocked(global.fetch).mockImplementation(
      (_input, init) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(
            () => resolve(response('Safety: Safe')),
            milliseconds,
          );
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        }),
    );

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('allows every card without a request when the escape hatch is active', async () => {
    const result = await serviceWith({ MODERATION_ALLOW_ALL: '1' }).check(
      input,
    );

    expect(result).toEqual({ ok: true, flagged: [], warnings: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails closed without AI_API_BASE', async () => {
    const result = await serviceWith({}).check(input);

    expect(result).toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('flags Unsafe cards and warns about Controversial cards', async () => {
    const mockFetch = jest.mocked(global.fetch);
    mockFetch
      .mockResolvedValueOnce(response('Safety: Safe Categories: None'))
      .mockResolvedValueOnce(
        response('Safety: Unsafe Categories: Unethical Acts'),
      )
      .mockResolvedValueOnce(
        response('Safety: Controversial\nCategories: Violent'),
      );

    const result = await serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check(input);

    expect(result).toEqual({
      ok: false,
      flagged: [{ cardId: 'card-2', reason: 'Unethical Acts' }],
      warnings: [{ cardId: 'card-3', reason: 'Violent' }],
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('passes when every card is Safe', async () => {
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response('Safety: Safe Categories: None'))
      .mockResolvedValueOnce(response('Safety: Safe'));

    const result = await serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check({ ...input, cards: cards.slice(0, 2) });

    expect(result).toEqual({ ok: true, flagged: [], warnings: [] });
  });

  it('fails closed on a non-200 response', async () => {
    jest
      .mocked(global.fetch)
      .mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).check(input),
    ).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
  });

  it('fails closed when the request rejects', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new TypeError('offline'));

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).check(input),
    ).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
  });

  it('fails closed when the response has no Safety line', async () => {
    jest.mocked(global.fetch).mockResolvedValue(response('No verdict here'));

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).check(input),
    ).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
  });

  it('sends one non-streaming moderation request per card', async () => {
    const mockFetch = jest.mocked(global.fetch);
    mockFetch.mockResolvedValue(response('Safety: Safe'));

    await serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1/',
      AI_API_KEY: 'test-key',
    }).check({ ...input, cards: cards.slice(0, 1) });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mock-ai.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
      }),
    );
    const request = mockFetch.mock.calls[0][1];
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(request?.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      model: 'moderation',
      temperature: 0,
      stream: false,
      messages: [{ role: 'user', content: 'front 1\nback 1' }],
    });
  });

  it('fails a hung gateway at the per-card cap within the deck budget', async () => {
    jest.useFakeTimers({ doNotFake: [] });
    jest.setSystemTime(0);
    fakeAbortTimeouts();
    jest.mocked(global.fetch).mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );

    const check = serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check(input);
    await jest.advanceTimersByTimeAsync(30_000);

    await expect(check).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'Moderation failed for deck deck-1 after 30000ms: AbortError',
    );
  });

  it('fails cumulative slow requests at the deck deadline', async () => {
    jest.useFakeTimers({ doNotFake: [] });
    jest.setSystemTime(0);
    fakeAbortTimeouts();
    const mockFetch = delayedSafeFetch(20_001);

    const check = serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check(input);
    await jest.advanceTimersByTimeAsync(60_000);

    await expect(check).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('passes twenty slow-but-healthy cards within the deck budget', async () => {
    jest.useFakeTimers({ doNotFake: [] });
    jest.setSystemTime(0);
    fakeAbortTimeouts();
    const mockFetch = delayedSafeFetch(100);
    const slowCards = Array.from({ length: 20 }, (_, index) => ({
      id: `card-${index}`,
      front: `front ${index}`,
      back: `back ${index}`,
    }));

    const check = serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check({ deckId: 'deck-1', cards: slowCards });
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(check).resolves.toEqual({
      ok: true,
      flagged: [],
      warnings: [],
    });
    expect(mockFetch).toHaveBeenCalledTimes(20);
  });
});
