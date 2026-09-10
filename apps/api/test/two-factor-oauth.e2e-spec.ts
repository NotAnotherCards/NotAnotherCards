import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { twoFactor, user } from '../src/database/schema';
import {
  createFakeOAuthProvider,
  type FakeOAuthProvider,
} from './helpers/fake-oauth-provider';

// Regression suite for issue #276: a linked OAuth provider must not bypass
// an enabled second factor. The OAuth round-trip runs against a loopback
// stub registered via OAUTH_TEST_PROVIDER_BASE_URL (test-only provider in
// AuthService — never configured outside tests), so no real Google/Facebook
// traffic is involved.
//
// NOTE: /two-factor/* endpoints are rate-limited per IP (3 per 10s, shared
// by this whole file because every request comes from localhost). Each test
// that touches them starts with paceTwoFactor() to guarantee a fresh window.
// Do not remove the pacing without re-checking the plugin's rateLimit.
const frontendOrigin = 'http://localhost:5173';
const testProviderId = 'test-oauth';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const paceTwoFactor = () => sleep(11_000);

function cookiesOf(res: request.Response): string[] {
  return (res.headers['set-cookie'] || []) as string[];
}

function hasSessionCookie(cookies: string[]): boolean {
  return cookies.some((cookie) => cookie.includes('better-auth.session_token'));
}

/**
 * A revoked session is communicated by *re-setting* the session cookie with
 * Max-Age=0 (see deleteSessionCookie in better-auth/cookies), so a naive
 * substring check mistakes a cleared cookie for a minted session. The
 * challenge assertions must use this variant: it only matches a live cookie.
 */
function hasLiveSessionCookie(cookies: string[]): boolean {
  return cookies.some(
    (cookie) =>
      cookie.includes('better-auth.session_token') &&
      !/Max-Age=0/i.test(cookie),
  );
}

function hasTwoFactorChallengeCookie(cookies: string[]): boolean {
  return cookies.some((cookie) => cookie.includes('two_factor='));
}

function secretFromTotpUri(totpUri: string): string {
  const encoded = new URL(totpUri).searchParams.get('secret');
  if (!encoded) throw new Error('enable response contained no TOTP secret');
  // The URI carries the base32 encoding of the raw secret (this is how the
  // server builds the URI). Codes must be computed over the decoded raw
  // secret — using the encoded form directly yields systematically wrong
  // codes and every verification fails.
  return new TextDecoder().decode(base32.decode(encoded));
}

describe('OAuth second-factor enforcement (e2e)', () => {
  let app: INestApplication<App>;
  let stub: FakeOAuthProvider;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOAuthTestProvider = process.env.OAUTH_TEST_PROVIDER_BASE_URL;

  const uniqueEmail = (tag: string) =>
    `oauth2fa-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'TestPassword123!';

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    stub = createFakeOAuthProvider();
    // AuthService reads this at module-compile time, so it must be set
    // before the testing module is created below.
    process.env.OAUTH_TEST_PROVIDER_BASE_URL = await stub.start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await stub?.stop();
    process.env.NODE_ENV = previousNodeEnv;
    if (previousOAuthTestProvider === undefined) {
      delete process.env.OAUTH_TEST_PROVIDER_BASE_URL;
    } else {
      process.env.OAUTH_TEST_PROVIDER_BASE_URL = previousOAuthTestProvider;
    }
  });

  async function signUp(email: string): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', frontendOrigin)
      .send({ email, password, name: 'OAuth 2FA Tester' })
      .expect(200);
    const cookies = cookiesOf(res);
    expect(hasSessionCookie(cookies)).toBe(true);
    return cookies;
  }

  async function signIn(email: string): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', frontendOrigin)
      .send({ email, password })
      .expect(200);
    return cookiesOf(res);
  }

  async function signOut(cookies: string[]): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Origin', frontendOrigin)
      .set('Cookie', cookies)
      .expect(200);
  }

  /**
   * Drives one full OAuth round-trip (initiate -> stub authorize -> app
   * callback) and returns the app's callback response with redirects
   * disabled, so 302 targets and Set-Cookie headers stay observable.
   */
  async function driveOAuthFlow(
    endpoint: '/api/auth/sign-in/social' | '/api/auth/link-social',
    sessionCookies: string[] = [],
  ): Promise<request.Response> {
    const init = await request(app.getHttpServer())
      .post(endpoint)
      .set('Origin', frontendOrigin)
      .set('Cookie', sessionCookies)
      .send({
        provider: testProviderId,
        callbackURL: `${frontendOrigin}/app/dashboard`,
      });
    const appCookies = cookiesOf(init);
    const authorizeUrl =
      init.status === 302
        ? init.headers.location
        : (init.body as { url: string }).url;
    expect(authorizeUrl).toContain('/authorize');

    const authorizeTarget = new URL(authorizeUrl);
    const authorize = await request(
      `${authorizeTarget.protocol}//${authorizeTarget.host}`,
    )
      .get(`${authorizeTarget.pathname}${authorizeTarget.search}`)
      .redirects(0);
    expect(authorize.status).toBe(302);
    const callbackUrl = new URL(authorize.headers.location);

    return request(app.getHttpServer())
      .get(`${callbackUrl.pathname}${callbackUrl.search}`)
      .set('Origin', frontendOrigin)
      .set('Cookie', appCookies)
      .redirects(0);
  }

  async function enableTwoFactor(
    sessionCookies: string[],
  ): Promise<{ totpUri: string; backupCodes: string[] }> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/two-factor/enable')
      .set('Origin', frontendOrigin)
      .set('Cookie', sessionCookies)
      .send({ password })
      .expect(200);
    const body = res.body as { totpURI: string; backupCodes: string[] };
    expect(body.totpURI).toContain('otpauth://');
    expect(body.backupCodes).toHaveLength(10);
    return { totpUri: body.totpURI, backupCodes: body.backupCodes };
  }

  async function verifyTotp(
    cookies: string[],
    code: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/auth/two-factor/verify-totp')
      .set('Origin', frontendOrigin)
      .set('Cookie', cookies)
      .send({ code });
  }

  async function verifyBackupCode(
    cookies: string[],
    code: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/auth/two-factor/verify-backup-code')
      .set('Origin', frontendOrigin)
      .set('Cookie', cookies)
      .send({ code });
  }

  async function linkTestProvider(
    sessionCookies: string[],
    email: string,
  ): Promise<void> {
    stub.setProfile({ email, name: 'OAuth 2FA Tester' });
    const callback = await driveOAuthFlow(
      '/api/auth/link-social',
      sessionCookies,
    );
    expect(callback.status).toBeLessThan(400);
    const accounts = await request(app.getHttpServer())
      .get('/api/auth/list-accounts')
      .set('Origin', frontendOrigin)
      .set('Cookie', sessionCookies)
      .expect(200);
    const providers = (accounts.body as Array<{ providerId: string }>).map(
      (account) => account.providerId,
    );
    expect(providers).toContain(testProviderId);
  }

  it('does not mint a session on linked-OAuth sign-in until the second factor verifies', async () => {
    await paceTwoFactor();
    const email = uniqueEmail('challenge');
    stub.setProfile({ email, name: 'OAuth 2FA Tester' });

    const signupCookies = await signUp(email);
    await linkTestProvider(signupCookies, email);
    await signOut(signupCookies);

    const sessionCookies = await signIn(email);
    const { totpUri } = await enableTwoFactor(sessionCookies);
    const secret = secretFromTotpUri(totpUri);
    const enrolled = await verifyTotp(
      sessionCookies,
      await createOTP(secret).totp(),
    );
    expect(enrolled.status).toBe(200);
    await signOut(cookiesOf(enrolled));

    const callback = await driveOAuthFlow('/api/auth/sign-in/social');
    const callbackCookies = cookiesOf(callback);
    // THE assertion: no usable session may exist before second-factor verification.
    expect(hasLiveSessionCookie(callbackCookies)).toBe(false);
    expect(hasTwoFactorChallengeCookie(callbackCookies)).toBe(true);
    expect(callback.headers.location).toContain('/two-factor');

    const completed = await verifyTotp(
      callbackCookies,
      await createOTP(secret).totp(),
    );
    expect(completed.status).toBe(200);
    const completedCookies = cookiesOf(completed);
    expect(hasSessionCookie(completedCookies)).toBe(true);

    const session = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Origin', frontendOrigin)
      .set('Cookie', completedCookies)
      .expect(200);
    expect((session.body as { user: { email: string } }).user.email).toBe(
      email,
    );
  }, 60_000);

  it('accepts a backup code exactly once during an OAuth challenge', async () => {
    await paceTwoFactor();
    const email = uniqueEmail('backup');
    stub.setProfile({ email, name: 'OAuth 2FA Tester' });

    const signupCookies = await signUp(email);
    await linkTestProvider(signupCookies, email);
    await signOut(signupCookies);

    const sessionCookies = await signIn(email);
    const { totpUri, backupCodes } = await enableTwoFactor(sessionCookies);
    const enrolled = await verifyTotp(
      sessionCookies,
      await createOTP(secretFromTotpUri(totpUri)).totp(),
    );
    expect(enrolled.status).toBe(200);
    await signOut(cookiesOf(enrolled));

    const first = await driveOAuthFlow('/api/auth/sign-in/social');
    const firstCookies = cookiesOf(first);
    expect(hasLiveSessionCookie(firstCookies)).toBe(false);
    const spent = await verifyBackupCode(firstCookies, backupCodes[0]);
    expect(spent.status).toBe(200);
    expect(hasSessionCookie(cookiesOf(spent))).toBe(true);
    await signOut(cookiesOf(spent));

    // Fresh challenge: the spent code must now fail (rate window reset first).
    await paceTwoFactor();
    const second = await driveOAuthFlow('/api/auth/sign-in/social');
    const reused = await verifyBackupCode(cookiesOf(second), backupCodes[0]);
    expect(reused.status).not.toBe(200);
  }, 90_000);

  it('rejects an invalid TOTP during an OAuth challenge without locking a first-time offender', async () => {
    await paceTwoFactor();
    const email = uniqueEmail('invalid');
    stub.setProfile({ email, name: 'OAuth 2FA Tester' });

    const signupCookies = await signUp(email);
    await linkTestProvider(signupCookies, email);
    await signOut(signupCookies);

    const sessionCookies = await signIn(email);
    const { totpUri } = await enableTwoFactor(sessionCookies);
    const secret = secretFromTotpUri(totpUri);
    const enrolled = await verifyTotp(
      sessionCookies,
      await createOTP(secret).totp(),
    );
    expect(enrolled.status).toBe(200);
    await signOut(cookiesOf(enrolled));

    const callback = await driveOAuthFlow('/api/auth/sign-in/social');
    const challengeCookies = cookiesOf(callback);
    await paceTwoFactor();
    const wrong = await verifyTotp(challengeCookies, '000000');
    expect(wrong.status).not.toBe(200);

    const recovered = await verifyTotp(
      challengeCookies,
      await createOTP(secret).totp(),
    );
    expect(recovered.status).toBe(200);
    expect(hasSessionCookie(cookiesOf(recovered))).toBe(true);
  }, 90_000);

  it('stores secrets encrypted and leaves 2FA unusable before verification', async () => {
    await paceTwoFactor();
    const email = uniqueEmail('atrest');

    const sessionCookies = await signUp(email);
    const me = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Origin', frontendOrigin)
      .set('Cookie', sessionCookies)
      .expect(200);
    const userId = (me.body as { user: { id: string } }).user.id;

    const { totpUri, backupCodes } = await enableTwoFactor(sessionCookies);
    const rawSecret = secretFromTotpUri(totpUri);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const rows = await drizzle(pool)
        .select()
        .from(twoFactor)
        .where(eq(twoFactor.userId, userId));
      expect(rows).toHaveLength(1);
      // Encrypted at rest: neither the raw secret nor any plaintext backup
      // code may appear in the stored row.
      expect(rows[0].secret).not.toContain(rawSecret);
      for (const code of backupCodes) {
        expect(rows[0].backupCodes).not.toContain(code);
      }
      // Not usable until verified: flag off and row unverified.
      expect(rows[0].verified).toBe(false);
      const [dbUser] = await drizzle(pool)
        .select({ twoFactorEnabled: user.twoFactorEnabled })
        .from(user)
        .where(eq(user.id, userId));
      expect(dbUser.twoFactorEnabled).toBe(false);
    } finally {
      await pool.end();
    }

    // Positive control: completing verification flips both markers, proving
    // the assertions above test the transition rather than a dead state.
    const enrolled = await verifyTotp(
      sessionCookies,
      await createOTP(rawSecret).totp(),
    );
    expect(enrolled.status).toBe(200);
  }, 60_000);

  it('rejects an expired-window TOTP during an OAuth challenge', async () => {
    await paceTwoFactor();
    const email = uniqueEmail('expired');
    stub.setProfile({ email, name: 'OAuth 2FA Tester' });

    const signupCookies = await signUp(email);
    await linkTestProvider(signupCookies, email);
    await signOut(signupCookies);

    const sessionCookies = await signIn(email);
    const { totpUri } = await enableTwoFactor(sessionCookies);
    const secret = secretFromTotpUri(totpUri);
    const enrolled = await verifyTotp(
      sessionCookies,
      await createOTP(secret).totp(),
    );
    expect(enrolled.status).toBe(200);
    await signOut(cookiesOf(enrolled));

    const callback = await driveOAuthFlow('/api/auth/sign-in/social');
    const challengeCookies = cookiesOf(callback);
    expect(hasLiveSessionCookie(challengeCookies)).toBe(false);

    // Five periods back is safely outside the server's ±1 verify window.
    const counter = Math.floor(Date.now() / 30_000);
    const stale = await verifyTotp(
      challengeCookies,
      await createOTP(secret).hotp(counter - 5),
    );
    expect(stale.status).not.toBe(200);
  }, 90_000);

  it('refuses 2FA enrollment for social-only accounts with a clear error', async () => {
    await paceTwoFactor();
    const email = uniqueEmail('socialonly');
    stub.setProfile({ email, name: 'Social Only' });

    // Fresh OAuth sign-up: the account has no credential (password) login.
    const callback = await driveOAuthFlow('/api/auth/sign-in/social');
    const callbackCookies = cookiesOf(callback);
    expect(hasSessionCookie(callbackCookies)).toBe(true);

    // allowPasswordless is disabled, so enrollment without a password must
    // fail loudly instead of creating an unusable 2FA setup.
    const res = await request(app.getHttpServer())
      .post('/api/auth/two-factor/enable')
      .set('Origin', frontendOrigin)
      .set('Cookie', callbackCookies)
      .send({})
      .expect(400);
    expect(JSON.stringify(res.body).toLowerCase()).toContain('password');
  }, 60_000);

  it('locks the account after repeated failed challenge verifications', async () => {
    await paceTwoFactor();
    const email = uniqueEmail('lockout');
    stub.setProfile({ email, name: 'OAuth 2FA Tester' });

    const signupCookies = await signUp(email);
    await linkTestProvider(signupCookies, email);
    await signOut(signupCookies);

    const sessionCookies = await signIn(email);
    const { totpUri } = await enableTwoFactor(sessionCookies);
    const secret = secretFromTotpUri(totpUri);
    const enrolled = await verifyTotp(
      sessionCookies,
      await createOTP(secret).totp(),
    );
    expect(enrolled.status).toBe(200);
    await signOut(cookiesOf(enrolled));

    const callback = await driveOAuthFlow('/api/auth/sign-in/social');
    const challengeCookies = cookiesOf(callback);
    expect(hasLiveSessionCookie(challengeCookies)).toBe(false);

    // Configured lockout is 5 failures; the shared 3-per-10s rate window
    // forces pacing between bursts (failures 1-3, pause, failures 4-5).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await verifyTotp(challengeCookies, '000000');
      expect(res.status).not.toBe(200);
    }
    await paceTwoFactor();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await verifyTotp(challengeCookies, '000000');
      expect(res.status).not.toBe(200);
    }

    // Even the correct code must now fail: the account is locked.
    const correct = await verifyTotp(
      challengeCookies,
      await createOTP(secret).totp(),
    );
    expect(correct.status).not.toBe(200);
  }, 120_000);
});
