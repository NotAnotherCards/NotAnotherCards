import {
  isOAuthChallengePath,
  twoFactorOAuthChallengeHook,
  withTwoFactorFlag,
} from '../auth/two-factor-oauth.hook';

const FRONTEND_URL = 'http://localhost:5173';
const FLAG_URL = `${FRONTEND_URL}/two-factor?twoFactorRequired=true`;

// The hook is run through `createAuthMiddleware`, so `createInternalContext`
// replaces json/redirect/setCookie with the real implementations and hands
// them their own response Headers. Asserting on the returned value (the 302
// APIError carries both the location and the accumulated Set-Cookie entries)
// proves the middleware actually executes instead of a mocked happy path.
const middleware = twoFactorOAuthChallengeHook(FRONTEND_URL);

type MockCtx = ReturnType<typeof makeMockCtx>['ctx'];

type ChallengeResponse = { statusCode?: number; headers: Headers };

type ChallengeDirective = {
  twoFactorRedirect: boolean;
  twoFactorMethods: string[];
};

function makeMockCtx(
  overrides: { path?: string; twoFactorEnabled?: boolean } = {},
) {
  const deleteSession = jest.fn();
  const createVerificationValue = jest.fn();
  const setNewSession = jest.fn();
  const createAuthCookie = jest.fn(
    (name: string, opts: { maxAge?: number }) => ({
      // The real helper prefixes every cookie name with `better-auth.`
      name: `better-auth.${name}`,
      attributes: { maxAge: opts.maxAge },
    }),
  );

  const ctx = {
    path: overrides.path ?? '/callback/google',
    headers: new Headers(),
    context: {
      newSession: {
        user: {
          id: 'usr_1',
          email: 'user@example.com',
          twoFactorEnabled: overrides.twoFactorEnabled ?? true,
        },
        session: { token: 'tok-1', id: 'sess-1' },
      },
      setNewSession,
      internalAdapter: { deleteSession, createVerificationValue },
      createAuthCookie,
      secret: 'unit-test-secret',
      authCookies: {
        sessionToken: {
          name: 'better-auth.session_token',
          attributes: { path: '/' },
        },
        sessionData: {
          name: 'better-auth.session_data',
          attributes: { path: '/' },
        },
        dontRememberToken: {
          name: 'better-auth.dont_remember',
          attributes: { path: '/' },
        },
      },
      options: {},
      oauthConfig: { storeStateStrategy: 'database' },
      logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
    },
  };

  return {
    ctx,
    spies: {
      deleteSession,
      createVerificationValue,
      setNewSession,
      createAuthCookie,
    },
  };
}

const runMiddleware = async <T>(ctx: MockCtx): Promise<T> =>
  (await middleware(ctx)) as unknown as T;

// Keep raw material (signed challenge cookie values, TOTP secrets, backup
// codes) out of Jest matcher operands: failures print the operands. Boolean
// flags keep the log opaque while still proving the header contract.
const setCookieNames = (headers: Headers): string[] =>
  headers.getSetCookie().map((cookie) => cookie.split('=')[0]);

const hasCookieWithMaxAge = (
  headers: Headers,
  name: string,
  maxAge: number,
): boolean =>
  headers
    .getSetCookie()
    .some(
      (cookie) =>
        cookie.startsWith(`${name}=`) && cookie.includes(`Max-Age=${maxAge}`),
    );

// The e2e suite proves the full OAuth round-trip over the generic
// `/oauth2/callback/:providerId` route (loopback provider). Real Google and
// Facebook providers use the built-in `/callback/:id` route template, which
// e2e cannot reach without live provider traffic — these tests pin the
// identical matcher branch and run the actual middleware against that route
// shape.
describe('twoFactorOAuthChallengeHook /callback/:id', () => {
  it('clears the session, issues the challenge, and 302s with the flag', async () => {
    const { ctx, spies } = makeMockCtx({ path: '/callback/google' });

    const response = await runMiddleware<ChallengeResponse>(ctx);

    expect(response.statusCode).toBe(302);
    expect(response.headers.get('location')).toBe(FLAG_URL);

    // The temporary OAuth session is gone from runtime state and the
    // database …
    expect(spies.setNewSession).toHaveBeenCalledWith(null);
    expect(spies.deleteSession).toHaveBeenCalledWith('tok-1');
    // … and its cookie is expired on the wire.
    expect(setCookieNames(response.headers)).toContain(
      'better-auth.session_token',
    );
    expect(
      hasCookieWithMaxAge(response.headers, 'better-auth.session_token', 0),
    ).toBe(true);

    // Challenge verification values: the identifier and its attempt counter.
    expect(spies.createVerificationValue).toHaveBeenCalledTimes(2);
    expect(spies.createVerificationValue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        value: 'usr_1',
        identifier: expect.stringMatching(/^2fa-[A-Za-z0-9_-]{20}$/) as unknown,
        expiresAt: expect.any(Date) as unknown,
      }),
    );
    expect(spies.createVerificationValue).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        value: '0',
        identifier: expect.stringMatching(
          /^2fa-attempts-2fa-[A-Za-z0-9_-]{20}$/,
        ) as unknown,
      }),
    );

    // The challenge cookie is set, signed, for 600s.
    expect(
      hasCookieWithMaxAge(response.headers, 'better-auth.two_factor', 600),
    ).toBe(true);
  });

  it('returns a JSON challenge directive on /sign-in/social while still clearing the session', async () => {
    const { ctx, spies } = makeMockCtx({ path: '/sign-in/social' });

    const result = await runMiddleware<ChallengeDirective>(ctx);

    expect(result).toEqual(
      expect.objectContaining({
        twoFactorRedirect: true,
        twoFactorMethods: ['totp'],
      }),
    );
    expect(spies.setNewSession).toHaveBeenCalledWith(null);
    expect(spies.deleteSession).toHaveBeenCalledWith('tok-1');
  });

  it('is a no-op on non-challenge routes', async () => {
    const { ctx, spies } = makeMockCtx({ path: '/sign-in/email' });

    const result = await runMiddleware<undefined>(ctx);

    expect(result).toBeUndefined();
    expect(spies.deleteSession).not.toHaveBeenCalled();
    expect(spies.setNewSession).not.toHaveBeenCalled();
  });

  it('is a no-op when the signing-in user has no 2FA enabled', async () => {
    const { ctx, spies } = makeMockCtx({
      path: '/callback/google',
      twoFactorEnabled: false,
    });

    const result = await runMiddleware<undefined>(ctx);

    expect(result).toBeUndefined();
    expect(spies.deleteSession).not.toHaveBeenCalled();
    expect(spies.setNewSession).not.toHaveBeenCalled();
  });
});

describe('withTwoFactorFlag', () => {
  it.each([
    [
      'http://localhost:5173/app/dashboard',
      'http://localhost:5173/app/dashboard?twoFactorRequired=true',
    ],
    [
      'http://localhost:5173/app/dashboard?from=a',
      'http://localhost:5173/app/dashboard?from=a&twoFactorRequired=true',
    ],
    [
      'http://localhost:5173/app/dashboard#section',
      'http://localhost:5173/app/dashboard?twoFactorRequired=true#section',
    ],
    [
      'http://localhost:5173/app/dashboard?page=2#section',
      'http://localhost:5173/app/dashboard?page=2&twoFactorRequired=true#section',
    ],
    [
      'notanothercards://dashboard',
      'notanothercards://dashboard?twoFactorRequired=true',
    ],
    [
      'notanothercards://dashboard#reviews',
      'notanothercards://dashboard?twoFactorRequired=true#reviews',
    ],
  ])('puts the flag into the query string of %s', (target, expected) => {
    expect(withTwoFactorFlag(target)).toBe(expected);
  });

  it('falls back to concatenation for unparseable targets', () => {
    expect(withTwoFactorFlag('/two-factor')).toBe(
      '/two-factor?twoFactorRequired=true',
    );
  });
});

describe('isOAuthChallengePath', () => {
  it('matches production built-in provider callbacks (/callback/:id)', () => {
    expect(isOAuthChallengePath('/callback/google')).toBe(true);
    expect(isOAuthChallengePath('/callback/facebook')).toBe(true);
  });

  it('matches the generic OAuth callback route (/oauth2/callback/:providerId)', () => {
    expect(isOAuthChallengePath('/oauth2/callback/test-oauth')).toBe(true);
  });

  it('rejects non-callback and plain authentication routes', () => {
    for (const path of [
      '/sign-in/email',
      '/sign-in/username',
      '/sign-in/social',
      '/link-social',
      '/unlink-account',
      '/two-factor/enable',
      '/two-factor/verify-totp',
      '/callback',
      '/oauth2/callback',
      '/',
      '',
    ]) {
      expect(isOAuthChallengePath(path)).toBe(false);
    }
  });
});
