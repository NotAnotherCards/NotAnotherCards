const mockGetCookie = jest.fn();

jest.mock('../lib/auth-client', () => ({
  authClient: {
    getCookie: () => mockGetCookie(),
  },
}));
jest.mock('../lib/api-url', () => ({ apiURL: 'http://api.test:3000' }));

import { completeOnboarding } from '../lib/onboarding';

const values = {
  username: 'philipp',
  native_language_id: '00000000-0000-0000-0000-000000000001',
  target_language_id: '00000000-0000-0000-0000-000000000002',
};

describe('completeOnboarding', () => {
  beforeEach(() => {
    mockGetCookie.mockReset();
    globalThis.fetch = jest.fn();
  });

  it('posts the values with the stored session cookie', async () => {
    mockGetCookie.mockReturnValue('session=abc');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await completeOnboarding(values);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test:3000/api/auth/onboard',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'session=abc',
        },
        body: JSON.stringify(values),
      },
    );
  });

  it('sends no cookie header without a stored session', async () => {
    mockGetCookie.mockReturnValue('');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await completeOnboarding(values);

    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers).toEqual({ 'content-type': 'application/json' });
  });

  it("surfaces the server's message on a taken username", async () => {
    mockGetCookie.mockReturnValue('session=abc');
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Username is already taken' }),
    });

    await expect(completeOnboarding(values)).rejects.toThrow(
      'Username is already taken',
    );
  });

  it('maps a connection failure onto the reachability message', async () => {
    mockGetCookie.mockReturnValue('session=abc');
    (globalThis.fetch as jest.Mock).mockRejectedValue(
      new TypeError('Network request failed'),
    );

    await expect(completeOnboarding(values)).rejects.toThrow(
      /Can't reach the server/,
    );
  });

  it('falls back to a generic message on a bodyless server error', async () => {
    mockGetCookie.mockReturnValue('session=abc');
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('no body')),
    });

    await expect(completeOnboarding(values)).rejects.toThrow(/HTTP 500/);
  });
});
