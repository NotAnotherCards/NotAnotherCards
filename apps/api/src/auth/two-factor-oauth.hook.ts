import { createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { generateRandomString } from 'better-auth/crypto';

// Must equal the two-factor plugin's internal TWO_FACTOR_COOKIE_NAME
// (better-auth 1.6.26, no public export). If an upgrade renames it, the
// OAuth-2FA regression test fails loudly — that is the tripwire.
const TWO_FACTOR_COOKIE_NAME = 'two_factor';
const CHALLENGE_MAX_AGE_SECONDS = 600;
const TWO_FACTOR_REQUIRED_FLAG = 'twoFactorRequired=true';
const FRONTEND_FALLBACK_PATH = '/two-factor';

// Matches the two route templates OAuth callbacks arrive on (ctx.path is the
// matched route template, not the concrete URL): built-in providers use
// `/callback/:id`, genericOAuth providers use `/oauth2/callback/:providerId`.
// Both must be covered or the bypass silently reopens for one provider family.
export const isOAuthChallengePath = (path: string): boolean =>
  path.startsWith('/callback/') || path.startsWith('/oauth2/callback/');

const isSocialSignInPath = (path: string): boolean =>
  path === '/sign-in/social';

/** Appends ?twoFactorRequired=true, preserving any existing query string. */
function withTwoFactorFlag(target: string): string {
  const flag = TWO_FACTOR_REQUIRED_FLAG;
  return target.includes('?') ? `${target}&${flag}` : `${target}?${flag}`;
}

export const twoFactorOAuthChallengeHook = (frontendUrl: string) =>
  createAuthMiddleware(async (ctx) => {
    const isOAuthCallback = isOAuthChallengePath(ctx.path);
    const isSocialSignIn = isSocialSignInPath(ctx.path);
    if (!isOAuthCallback && !isSocialSignIn) return;

    const newSession = ctx.context.newSession;
    if (!newSession?.user?.twoFactorEnabled) return;

    deleteSessionCookie(ctx, true);
    await ctx.context.internalAdapter.deleteSession(newSession.session.token);
    ctx.context.setNewSession(null);

    const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME, {
      maxAge: CHALLENGE_MAX_AGE_SECONDS,
    });
    const identifier = `2fa-${generateRandomString(20)}`;
    const expiresAt = new Date(Date.now() + CHALLENGE_MAX_AGE_SECONDS * 1000);
    await ctx.context.internalAdapter.createVerificationValue({
      value: newSession.user.id,
      identifier,
      expiresAt,
    });
    await ctx.context.internalAdapter.createVerificationValue({
      value: '0',
      identifier: `2fa-attempts-${identifier}`,
      expiresAt,
    });
    await ctx.setSignedCookie(
      cookie.name,
      identifier,
      ctx.context.secret,
      cookie.attributes,
    );

    if (isSocialSignIn) {
      return ctx.json({ twoFactorRedirect: true, twoFactorMethods: ['totp'] });
    }

    // Redirect back to the original callback target instead of a fixed web
    // page, so an Expo deep link (`notanothercards://…`) survives to the
    // native 2FA flow. The challenge Set-Cookie above rides on this 302 in
    // both flows.
    //
    // The endpoint already parsed and stored the OAuth state on this request
    // via setOAuthState (better-auth keeps it in a per-request store, NOT the
    // verification row the endpoint consumed), so getOAuthState() safely
    // returns the stateData — including the plugin-validated callbackURL —
    // without touching the database again. On the impossible path where no
    // state is present (e.g. a pre-state redirectOnError), fall back to the
    // web page rather than hanging or 500ing.
    const state = await getOAuthState();
    const callbackUrl =
      (state as { callbackURL?: string } | null)?.callbackURL ??
      `${frontendUrl}${FRONTEND_FALLBACK_PATH}`;

    return ctx.redirect(withTwoFactorFlag(callbackUrl));
  });
