import { createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { generateRandomString } from 'better-auth/crypto';

// Must equal the two-factor plugin's internal TWO_FACTOR_COOKIE_NAME
// (better-auth 1.6.26, no public export). If an upgrade renames it, the
// OAuth-2FA regression test fails loudly — that is the tripwire.
const TWO_FACTOR_COOKIE_NAME = 'two_factor';
const CHALLENGE_MAX_AGE_SECONDS = 600;
const TWO_FACTOR_REQUIRED_FLAG_NAME = 'twoFactorRequired';
const TWO_FACTOR_REQUIRED_FLAG_VALUE = 'true';
const FRONTEND_FALLBACK_PATH = '/two-factor';

// Matches the two route templates OAuth callbacks arrive on (ctx.path is the
// matched route template, not the concrete URL): built-in providers use
// `/callback/:id`, genericOAuth providers use `/oauth2/callback/:providerId`.
// Both must be covered or the bypass silently reopens for one provider family.
export const isOAuthChallengePath = (path: string): boolean =>
  path.startsWith('/callback/') || path.startsWith('/oauth2/callback/');

const isSocialSignInPath = (path: string): boolean =>
  path === '/sign-in/social';

/**
 * Appends the ?twoFactorRequired=true flag to the callback target. Built on
 * URL + searchParams so the flag lands in the query string even when the
 * target already has one or carries a fragment (string concatenation would
 * drop the flag after `#fragment`). Fall back to manual string handling for
 * relative targets, which `new URL` refuses — but still insert the flag
 * before any `#fragment` so it stays a query parameter.
 */
export function withTwoFactorFlag(target: string): string {
  try {
    const url = new URL(target);
    url.searchParams.set(
      TWO_FACTOR_REQUIRED_FLAG_NAME,
      TWO_FACTOR_REQUIRED_FLAG_VALUE,
    );
    return url.toString();
  } catch {
    const flag = `${TWO_FACTOR_REQUIRED_FLAG_NAME}=${TWO_FACTOR_REQUIRED_FLAG_VALUE}`;
    const hashIndex = target.indexOf('#');
    const queryPortion = hashIndex === -1 ? target : target.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : target.slice(hashIndex);
    const withFlag = queryPortion.includes('?')
      ? `${queryPortion}&${flag}`
      : `${queryPortion}?${flag}`;
    return `${withFlag}${fragment}`;
  }
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
    // without touching the database again. When no request state is present
    // (e.g. a pre-state redirectOnError, or out-of-band invocation),
    // getOAuthState() throws instead of returning null — fall back to the
    // web page rather than hanging or 500ing.
    let callbackUrl = `${frontendUrl}${FRONTEND_FALLBACK_PATH}`;
    try {
      const state = (await getOAuthState()) as { callbackURL?: string } | null;
      callbackUrl = state?.callbackURL ?? callbackUrl;
    } catch {
      // no request state — keep the web-page fallback above
    }

    return ctx.redirect(withTwoFactorFlag(callbackUrl));
  });
