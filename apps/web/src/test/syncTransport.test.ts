/**
 * Web's slice of the transport (#52, #148): relative URLs, the cookie
 * jar, and abort forwarding. Classification and wire validation are
 * remelonDB's and are tested upstream.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pullChanges, pushChanges, SyncTransportError } from '../offline/sync';

const emptyChanges = {
  user_decks: { created: [], updated: [], deleted: [] },
  user_cards: { created: [], updated: [], deleted: [] },
  review_events: { created: [], updated: [], deleted: [] },
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const mockFetch = (impl: typeof fetch) => {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
};

afterEach(() => vi.unstubAllGlobals());

describe('sync transport', () => {
  it('pulls: posts args with credentials and returns the parsed package', async () => {
    const spy = mockFetch(async () =>
      jsonResponse(200, { cursor: '7', changes: emptyChanges }),
    );
    const result = await pullChanges({
      cursor: null,
      schemaVersion: 1,
      migration: null,
    });
    expect(result).toEqual({ cursor: '7', changes: emptyChanges });
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toBe('/sync/pull');
    expect(init?.credentials).toBe('include');
    expect(init?.method).toBe('POST');
  });

  it('pushes: returns the parsed acknowledgement including rejections', async () => {
    mockFetch(async () =>
      jsonResponse(200, {
        cursor: null,
        changes: null,
        rejected: { review_events: ['r1'] },
      }),
    );
    const result = await pushChanges({
      cursor: '7',
      changes: emptyChanges,
    });
    expect(result).toMatchObject({ rejected: { review_events: ['r1'] } });
  });

  it('401 is a transport error carrying the status', async () => {
    mockFetch(async () => jsonResponse(401, { message: 'no session' }));
    const attempt = pullChanges({
      cursor: null,
      schemaVersion: 1,
      migration: null,
    });
    await expect(attempt).rejects.toBeInstanceOf(SyncTransportError);
    await expect(
      pullChanges({ cursor: null, schemaVersion: 1, migration: null }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('forwards the abort signal to fetch', async () => {
    const spy = mockFetch(async () =>
      jsonResponse(200, { cursor: null, changes: null }),
    );
    const controller = new AbortController();
    await pushChanges(
      { cursor: '1', changes: emptyChanges },
      controller.signal,
    );
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });
});
