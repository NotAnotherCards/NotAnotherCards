/**
 * Transport for /sync/pull and /sync/push (#52): authenticated fetch,
 * wire-parsed responses, protocol outcomes passed through, everything
 * else a transport error that must never masquerade as protocol.
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

  it('passes conflict through as a protocol outcome', async () => {
    mockFetch(async () => jsonResponse(200, { conflict: true }));
    expect(await pushChanges({ cursor: '1', changes: emptyChanges })).toEqual({
      conflict: true,
    });
  });

  it('passes resyncRequired through as a protocol outcome', async () => {
    mockFetch(async () => jsonResponse(200, { resyncRequired: true }));
    expect(
      await pullChanges({ cursor: '9', schemaVersion: 1, migration: null }),
    ).toEqual({ resyncRequired: true });
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

  it('5xx is a transport error', async () => {
    mockFetch(async () => jsonResponse(503, {}));
    await expect(
      pushChanges({ cursor: '1', changes: emptyChanges }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('malformed json is a transport error', async () => {
    mockFetch(
      async () => new Response('<html>gateway</html>', { status: 200 }),
    );
    await expect(
      pullChanges({ cursor: null, schemaVersion: 1, migration: null }),
    ).rejects.toBeInstanceOf(SyncTransportError);
  });

  it('a wire-shape violation is a transport error, not data', async () => {
    mockFetch(async () => jsonResponse(200, { cursor: 7, changes: 'nope' }));
    await expect(
      pullChanges({ cursor: null, schemaVersion: 1, migration: null }),
    ).rejects.toBeInstanceOf(SyncTransportError);
  });

  it('a network failure is a transport error', async () => {
    mockFetch(async () => {
      throw new TypeError('NetworkError when attempting to fetch resource');
    });
    await expect(
      pushChanges({ cursor: '1', changes: emptyChanges }),
    ).rejects.toBeInstanceOf(SyncTransportError);
  });
});
