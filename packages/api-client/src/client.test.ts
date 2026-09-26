import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client.js';
import { ApiTimeoutError } from './transport.js';

afterEach(() => vi.useRealTimers());
const deck = {
  id: 'a/b',
  title: 'Words',
  description: null,
  noteType: 'word',
  nativeLanguageId: null,
  targetLanguageId: null,
  cardCount: 1,
  owner: { username: 'test' },
  updatedAt: 1,
};
const setup = (body: unknown, status = 200) => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(
      async () => new Response(JSON.stringify(body), { status }),
    );
  return { fetch, client: createApiClient({ baseUrl: '', fetch }) };
};
describe('community and publishing endpoints', () => {
  it('lists with optional pagination, leaving defaults to the server', async () => {
    const { client, fetch } = setup({ decks: [deck] });
    expect(await client.sharedDecks.list()).toEqual({ decks: [deck] });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/shared/decks',
      expect.anything(),
    );
    await client.sharedDecks.list({ limit: 20, offset: 40 });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/shared/decks?limit=20&offset=40',
      expect.anything(),
    );
  });
  it('previews a deck with an encoded id', async () => {
    const preview = { ...deck, cards: [{ front: 'a', back: 'b' }] };
    const { client, fetch } = setup({ deck: preview });
    expect(await client.sharedDecks.preview('a/b')).toEqual({ deck: preview });
    expect(fetch).toHaveBeenCalledWith(
      '/api/shared/decks/a%2Fb',
      expect.anything(),
    );
  });
  it('imports once and returns the new deck id', async () => {
    const { client, fetch } = setup({ deckId: 'copy' }, 201);
    expect(await client.sharedDecks.import('a/b')).toEqual({ deckId: 'copy' });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      '/api/shared/decks/a%2Fb/import',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('reports a reason and validates the response', async () => {
    const body = {
      report: {
        id: 'r',
        deckId: 'd',
        reporterUserId: 'u',
        reason: 'reason',
        snapshotPublishedAt: '2026-01-01',
        createdAt: '2026-01-01',
      },
      recheck: 'queued',
    };
    const { client, fetch } = setup(body, 201);
    expect(
      (await client.sharedDecks.report('a/b', 'reason')).report.createdAt,
    ).toBeInstanceOf(Date);
    expect(fetch).toHaveBeenCalledWith(
      '/api/shared/decks/a%2Fb/report',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'reason' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  it('publishes and returns warnings', async () => {
    const warnings = [{ cardId: 'c', reason: 'r' }];
    const { client, fetch } = setup({ visibility: 'public', warnings });
    expect(await client.publishing.publish('a/b')).toEqual({
      published: true,
      warnings,
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/decks/a%2Fb/publish',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('returns a valid 422 refusal, but throws other failures', async () => {
    const refusal = { reason: 'no', flagged: [{ cardId: 'c', reason: 'r' }] };
    expect(await setup(refusal, 422).client.publishing.publish('d')).toEqual({
      published: false,
      refusal,
    });
    await expect(
      setup({ message: 'invalid' }, 422).client.publishing.publish('d'),
    ).rejects.toMatchObject({ status: 422, message: 'invalid' });
    await expect(
      setup(refusal, 500).client.publishing.publish('d'),
    ).rejects.toMatchObject({ status: 500 });
  });
  it('unpublishes without exposing raw data', async () => {
    const { client, fetch } = setup({ visibility: 'private' });
    expect(await client.publishing.unpublish('a/b')).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      '/api/decks/a%2Fb/unpublish',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('reads moderation status', async () => {
    const { client, fetch } = setup({ status: 'clear' });
    expect(await client.publishing.moderationStatus('a/b')).toEqual({
      status: 'clear',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/decks/a%2Fb/moderation',
      expect.anything(),
    );
  });
  it('rejects an invalid successful response', async () => {
    await expect(
      setup({ deckId: 7 }).client.sharedDecks.import('d'),
    ).rejects.toThrow();
  });
  it('streams validated explanation deltas and result', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(
          'data: {"type":"delta","delta":"Part"}\n\ndata: {"type":"result","explanation":"Whole"}\n\n',
        ),
      );
    const input = { cardId: 'c', reason: 'r', source: 'working' as const };
    const onDelta = vi.fn();
    expect(
      await createApiClient({ baseUrl: '', fetch }).publishing.explain(
        'a/b',
        input,
        onDelta,
      ),
    ).toBe('Whole');
    expect(onDelta).toHaveBeenCalledWith('Part');
    expect(fetch).toHaveBeenCalledWith(
      '/api/decks/a%2Fb/moderation/explain',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
  it('limits explanation streams to 100 KB', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('x'.repeat(100_001)));
    await expect(
      createApiClient({ baseUrl: '', fetch }).publishing.explain(
        'd',
        { cardId: 'c', reason: 'r', source: 'working' },
        () => {},
      ),
    ).rejects.toThrow('too large');
  });
  it('uses 15 s for JSON and 60 s for streams, including body reads', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(
        async () => new Response(new ReadableStream({ cancel })),
      );
    const client = createApiClient({ baseUrl: '', fetch });
    const json = expect(client.sharedDecks.import('d')).rejects.toBeInstanceOf(
      ApiTimeoutError,
    );
    const stream = client.publishing.explain(
      'd',
      { cardId: 'c', reason: 'r', source: 'working' },
      () => {},
    );
    const streamCheck = expect(stream).rejects.toBeInstanceOf(ApiTimeoutError);
    const settled = vi.fn();
    void stream.catch(settled);
    await vi.advanceTimersByTimeAsync(15_000);
    await json;
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(45_000);
    await streamCheck;
    expect(cancel).toHaveBeenCalled();
  });
});
