const mockGetCookie = jest.fn<string, []>();
const mockGetSession = jest.fn();

jest.mock('../lib/auth-client', () => ({
  authClient: {
    getCookie: () => mockGetCookie(),
    getSession: (...args: unknown[]) => mockGetSession(...args),
  },
}));
jest.mock('../lib/api-url', () => ({ apiURL: 'http://api.test:3000' }));

import { pullChanges, pushChanges, SyncTransportError } from '../lib/sync';

const emptyChanges = {
  user_decks: { created: [], updated: [], deleted: [] },
  user_cards: { created: [], updated: [], deleted: [] },
  review_events: { created: [], updated: [], deleted: [] },
  user_profiles: { created: [], updated: [], deleted: [] },
};

const pullArgs = { cursor: null, schemaVersion: 2, migration: null };
const pushArgs = { cursor: '7', changes: emptyChanges };

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

let fetchSpy: jest.Mock;

const mockFetch = (impl: (...args: unknown[]) => Promise<Response>) => {
  fetchSpy = jest.fn(impl);
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
};

const requestInit = () => fetchSpy.mock.calls[0]?.[1] as RequestInit;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCookie.mockReturnValue('better-auth.session_token=abc');
});

describe('mobile sync transport', () => {
  it('posts pull args to the absolute API URL with the cached cookie', async () => {
    mockFetch(async () =>
      jsonResponse(200, { cursor: '1', changes: emptyChanges }),
    );
    const result = await pullChanges(pullArgs);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://api.test:3000/sync/pull',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(requestInit().headers).toMatchObject({
      cookie: 'better-auth.session_token=abc',
    });
    expect(JSON.parse(requestInit().body as string)).toEqual(pullArgs);
    expect(result).toMatchObject({ cursor: '1' });
  });

  it('posts push args and returns rejections as data', async () => {
    mockFetch(async () =>
      jsonResponse(200, {
        cursor: null,
        changes: null,
        rejected: { review_events: ['r1'] },
      }),
    );
    const result = await pushChanges(pushArgs);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://api.test:3000/sync/push',
      expect.anything(),
    );
    expect(JSON.parse(requestInit().body as string)).toEqual(pushArgs);
    expect(result).toMatchObject({ rejected: { review_events: ['r1'] } });
  });

  it('reads the cookie for each request and never calls getSession', async () => {
    mockFetch(async () => jsonResponse(200, { cursor: null, changes: null }));
    mockGetCookie
      .mockReturnValueOnce('better-auth.session_token=first')
      .mockReturnValueOnce('better-auth.session_token=second');
    await pushChanges(pushArgs);
    await pushChanges(pushArgs);

    expect(mockGetCookie).toHaveBeenCalledTimes(2);
    expect(mockGetSession).not.toHaveBeenCalled();
    // an account switch changes the cookie between requests; the second
    // request must carry the new one, not a value captured earlier
    const headersOf = (call: number) =>
      (fetchSpy.mock.calls[call]?.[1] as RequestInit).headers;
    expect(headersOf(0)).toMatchObject({
      cookie: 'better-auth.session_token=first',
    });
    expect(headersOf(1)).toMatchObject({
      cookie: 'better-auth.session_token=second',
    });
  });

  it('sends no cookie header when the cached cookie is empty', async () => {
    mockGetCookie.mockReturnValue('');
    mockFetch(async () => jsonResponse(200, { cursor: null, changes: null }));
    await pushChanges(pushArgs);

    expect(requestInit().headers).not.toHaveProperty('cookie');
  });

  it('401 is a transport error carrying the status', async () => {
    mockFetch(async () => jsonResponse(401, { message: 'Unauthorized' }));
    const error = await pullChanges(pullArgs).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SyncTransportError);
    expect((error as SyncTransportError).status).toBe(401);
  });

  it('forwards the abort signal to fetch', async () => {
    mockFetch(async () => jsonResponse(200, { cursor: null, changes: null }));
    const controller = new AbortController();
    await pushChanges(pushArgs, controller.signal);
    expect(requestInit().signal).toBe(controller.signal);
  });
});
