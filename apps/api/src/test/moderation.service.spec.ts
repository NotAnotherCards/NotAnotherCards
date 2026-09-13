import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ModerationService,
  moderationDeadlineMs,
  parseModerationOutput,
} from '../sharing/moderation.service';

describe('ModerationService', () => {
  const cards = [
    { id: 'card-1', front: 'front 1', back: 'back 1' },
    { id: 'card-2', front: 'front 2', back: 'back 2' },
    { id: 'card-3', front: 'front 3', back: 'back 3' },
  ];
  const input = { deckId: 'deck-1', cards };
  const manyCards = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `card-${index}`,
      front: `front ${index}`,
      back: `back ${index}`,
    }));
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

    expect(result).toEqual({
      ok: true,
      flagged: [],
      warnings: [],
      results: [],
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails closed without AI_API_BASE', async () => {
    const result = await serviceWith({}).check(input);

    expect(result).toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
      results: cards.map((card) => ({
        cardId: card.id,
        classifier: 'moderation',
        verdict: 'error',
        categories: null,
        error: 'gateway_unconfigured',
      })),
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
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'safe',
          categories: [],
        },
        {
          cardId: 'card-2',
          classifier: 'moderation',
          verdict: 'unsafe',
          categories: ['Unethical Acts'],
        },
        {
          cardId: 'card-3',
          classifier: 'moderation',
          verdict: 'controversial',
          categories: ['Violent'],
        },
      ],
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

    expect(result).toEqual({
      ok: true,
      flagged: [],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'safe',
          categories: [],
        },
        {
          cardId: 'card-2',
          classifier: 'moderation',
          verdict: 'safe',
          categories: [],
        },
      ],
    });
  });

  it('uses the fast gate plus an independent classifier for a thorough re-check', async () => {
    const mockFetch = jest.mocked(global.fetch);
    mockFetch
      .mockResolvedValueOnce(response('Safety: Safe Categories: None'))
      // ShieldGemma's real native response contract: Yes means unsafe.
      .mockResolvedValueOnce(response('Yes'));

    const result = await serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).checkThorough({ ...input, cards: cards.slice(0, 1) });

    expect(result).toEqual({
      ok: false,
      flagged: [
        {
          cardId: 'card-1',
          reason: 'Unsafe',
          classifier: 'moderation-thorough',
        },
      ],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'safe',
          categories: [],
        },
        {
          cardId: 'card-1',
          classifier: 'moderation-thorough',
          verdict: 'unsafe',
          categories: null,
        },
      ],
    });
    expect(
      mockFetch.mock.calls.map(
        (call) => JSON.parse(call[1]?.body as string) as unknown,
      ),
    ).toEqual([
      expect.objectContaining({ model: 'moderation' }),
      expect.objectContaining({ model: 'moderation-thorough' }),
    ]);
  });

  it('accepts ShieldGemma safe output from the thorough alias', async () => {
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response('Safety: Safe Categories: None'))
      .mockResolvedValueOnce(response('No'));

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).checkThorough({
        ...input,
        cards: cards.slice(0, 1),
      }),
    ).resolves.toEqual({
      ok: true,
      flagged: [],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'safe',
          categories: [],
        },
        {
          cardId: 'card-1',
          classifier: 'moderation-thorough',
          verdict: 'safe',
          categories: null,
        },
      ],
    });
  });

  it('has explicit parsers for every benchmarked native output shape', () => {
    expect(
      parseModerationOutput(
        'qwen3guard',
        'Safety: Unsafe\nCategories: Violent',
      ),
    ).toEqual({
      grade: 'unsafe',
      categories: ['Violent'],
    });
    expect(parseModerationOutput('shieldgemma', 'Yes')).toEqual({
      grade: 'unsafe',
      categories: null,
    });
    expect(parseModerationOutput('llama-guard', 'unsafe\nS1')).toEqual({
      grade: 'unsafe',
      categories: ['S1'],
    });
    expect(
      parseModerationOutput(
        'granite-guardian',
        '<think>review</think>\n<score> yes </score>',
      ),
    ).toEqual({ grade: 'unsafe', categories: null });
  });

  it('keeps an Unsafe finding when the other classifier is unavailable', async () => {
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response('Safety: Unsafe Categories: Hate'))
      .mockRejectedValueOnce(new TypeError('second classifier offline'));

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).checkThorough({
        ...input,
        cards: cards.slice(0, 1),
      }),
    ).resolves.toEqual({
      ok: false,
      flagged: [{ cardId: 'card-1', reason: 'Hate', classifier: 'moderation' }],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'unsafe',
          categories: ['Hate'],
        },
        {
          cardId: 'card-1',
          classifier: 'moderation-thorough',
          verdict: 'error',
          categories: null,
          error: 'request_error',
        },
      ],
    });
  });

  it('still blocks when the fast classifier fails before the independent classifier', async () => {
    const mockFetch = jest.mocked(global.fetch);
    mockFetch
      .mockResolvedValueOnce(response('not a Qwen verdict'))
      .mockResolvedValueOnce(response('Yes'));

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).checkThorough({
        ...input,
        cards: cards.slice(0, 1),
      }),
    ).resolves.toEqual({
      ok: false,
      flagged: [
        {
          cardId: 'card-1',
          reason: 'Unsafe',
          classifier: 'moderation-thorough',
        },
      ],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'error',
          categories: null,
          error: 'unparseable',
        },
        {
          cardId: 'card-1',
          classifier: 'moderation-thorough',
          verdict: 'unsafe',
          categories: null,
        },
      ],
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('gives the independent classifier its own deadline after the fast classifier times out', async () => {
    jest.useFakeTimers({ doNotFake: [] });
    jest.setSystemTime(0);
    fakeAbortTimeouts();
    const mockFetch = jest.mocked(global.fetch);
    mockFetch
      .mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }),
      )
      .mockResolvedValueOnce(response('Yes'));

    const check = serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).checkThorough({ ...input, cards: cards.slice(0, 1) });
    await jest.advanceTimersByTimeAsync(6_000);

    const result = await check;
    expect(result.ok).toBe(false);
    expect(result.flagged).toEqual([
      expect.objectContaining({ classifier: 'moderation-thorough' }),
    ]);
    expect(result.results).toEqual([
      expect.objectContaining({ classifier: 'moderation', error: 'timeout' }),
      expect.objectContaining({
        classifier: 'moderation-thorough',
        verdict: 'unsafe',
      }),
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns unavailable only after the other classifier runs and no one finds unsafe content', async () => {
    const mockFetch = jest.mocked(global.fetch);
    mockFetch
      .mockRejectedValueOnce(new TypeError('fast classifier offline'))
      .mockResolvedValueOnce(response('No'));

    const result = await serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).checkThorough({ ...input, cards: cards.slice(0, 1) });

    expect(result).toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'error',
          categories: null,
          error: 'request_error',
        },
        {
          cardId: 'card-1',
          classifier: 'moderation-thorough',
          verdict: 'safe',
          categories: null,
        },
      ],
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('fails closed on a non-200 response', async () => {
    jest
      .mocked(global.fetch)
      .mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).check({
        ...input,
        cards: cards.slice(0, 1),
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'error',
          categories: null,
          error: 'gateway_error',
        },
      ],
    });
  });

  it('fails closed when the request rejects', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new TypeError('offline'));

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).check({
        ...input,
        cards: cards.slice(0, 1),
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'error',
          categories: null,
          error: 'request_error',
        },
      ],
    });
  });

  it('fails closed when the response has no Safety line', async () => {
    jest.mocked(global.fetch).mockResolvedValue(response('No verdict here'));

    await expect(
      serviceWith({ AI_API_BASE: 'https://mock-ai.test/v1' }).check({
        ...input,
        cards: cards.slice(0, 1),
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
      results: [
        {
          cardId: 'card-1',
          classifier: 'moderation',
          verdict: 'error',
          categories: null,
          error: 'unparseable',
        },
      ],
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

  it('scales the deck budget with the card count, capped under nginx', () => {
    expect(moderationDeadlineMs(0)).toBe(5_000);
    expect(moderationDeadlineMs(200)).toBe(205_000);
    expect(moderationDeadlineMs(500)).toBe(240_000);
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

    // Forty cards give a 45 s deck budget, so the 30 s per-card cap fires first.
    const check = serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check({ deckId: 'deck-1', cards: manyCards(40) });
    await jest.advanceTimersByTimeAsync(45_000);

    const result = await check;
    expect(result).toMatchObject({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
    expect(result.results).toHaveLength(40);
    expect(result.results[0]).toEqual(
      expect.objectContaining({ verdict: 'error', error: 'timeout' }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Moderation had 40 failed request(s) for deck deck-1 after 45000ms',
      ),
    );
  });

  it('fails cumulative slow requests at the deck deadline', async () => {
    jest.useFakeTimers({ doNotFake: [] });
    jest.setSystemTime(0);
    fakeAbortTimeouts();
    // Three cards give an 8 s deck budget; the third call runs out of it.
    const mockFetch = delayedSafeFetch(3_001);

    const check = serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check(input);
    await jest.advanceTimersByTimeAsync(8_000);

    const result = await check;
    expect(result).toMatchObject({
      ok: false,
      reason: 'moderation unavailable',
      flagged: [],
      warnings: [],
    });
    expect(result.results).toHaveLength(3);
    expect(result.results.map(({ verdict }) => verdict)).toEqual([
      'safe',
      'safe',
      'error',
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('passes twenty slow-but-healthy cards within the deck budget', async () => {
    jest.useFakeTimers({ doNotFake: [] });
    jest.setSystemTime(0);
    fakeAbortTimeouts();
    const mockFetch = delayedSafeFetch(100);

    const check = serviceWith({
      AI_API_BASE: 'https://mock-ai.test/v1',
    }).check({ deckId: 'deck-1', cards: manyCards(20) });
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(check).resolves.toEqual({
      ok: true,
      flagged: [],
      warnings: [],
      results: manyCards(20).map((card) => ({
        cardId: card.id,
        classifier: 'moderation',
        verdict: 'safe',
        categories: [],
      })),
    });
    expect(mockFetch).toHaveBeenCalledTimes(20);
  });
});
