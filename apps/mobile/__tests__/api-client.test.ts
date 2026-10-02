import { apiClient } from '@/lib/api-client';

// The calls themselves are @repo/api-client's and tested there; this
// checks the app's transport: the API host, the session cookie, and the
// shapes the screens rely on.
const mockGetCookie = jest.fn<string | null, []>();
jest.mock('../lib/auth-client', () => ({
  authClient: {
    getCookie: () => mockGetCookie(),
  },
}));
jest.mock('../lib/api-url', () => ({ apiURL: 'http://api.test:3000' }));

const summary = {
  id: 'd1',
  title: 'Spanish A1',
  description: null,
  noteType: 'word',
  nativeLanguageId: 'en',
  targetLanguageId: 'es',
  cardCount: 12,
  owner: { username: 'ana' },
  updatedAt: 1,
};

const respond = (status: number, body: unknown) =>
  (globalThis.fetch as jest.Mock).mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );

describe('the app transport for the shared API calls', () => {
  beforeEach(() => {
    mockGetCookie.mockReset();
    mockGetCookie.mockReturnValue('session=abc');
    globalThis.fetch = jest.fn();
  });

  it('calls the API host with the session cookie and the page', async () => {
    respond(200, { decks: [summary] });

    await expect(
      apiClient.sharedDecks.list({ limit: 50, offset: 50 }),
    ).resolves.toEqual({ decks: [summary] });
    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'http://api.test:3000/api/shared/decks?limit=50&offset=50',
    );
    expect(init.headers).toMatchObject({ cookie: 'session=abc' });
  });

  it('sends no cookie header when there is no session', async () => {
    mockGetCookie.mockReturnValue(null);
    respond(201, {
      report: {
        id: 'r1',
        deckId: 'd1',
        reporterUserId: 'u1',
        reason: 'spam',
        snapshotPublishedAt: '2026-09-26T00:00:00.000Z',
        createdAt: '2026-09-26T00:00:00.000Z',
      },
      recheck: 'queued',
    });

    await apiClient.sharedDecks.report('d1', 'spam');
    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ reason: 'spam' }));
    expect(init.headers).not.toHaveProperty('cookie');
  });

  it("turns moderation's 422 into a refusal outcome", async () => {
    respond(422, { flagged: [{ cardId: 'c1', reason: 'hate speech' }] });

    await expect(apiClient.publishing.publish('d1')).resolves.toEqual({
      published: false,
      refusal: { flagged: [{ cardId: 'c1', reason: 'hate speech' }] },
    });
  });
});
