import { createAuthMiddleware } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { generateRandomString } from 'better-auth/crypto';

// Must equal the two-factor plugin's internal TWO_FACTOR_COOKIE_NAME
// (better-auth 1.6.26, no public export). If an upgrade renames it, the
// OAuth-2FA regression test fails loudly — that is the tripwire.
const TWO_FACTOR_COOKIE_NAME = 'two_factor';
const CHALLENGE_MAX_AGE_SECONDS = 600;

export const twoFactorOAuthChallengeHook = (frontendUrl: string) =>
  createAuthMiddleware(async (ctx) => {
    // OAuth callbacks arrive on two route shapes, depending on the provider
    // kind (ctx.path is the matched route template, not the concrete URL):
    // built-in providers use `/callback/:id`, genericOAuth providers use
    // `/oauth2/callback/:providerId`. Both must be covered or the bypass
    // silently reopens for one provider family.
    const isOAuthCallback =
      ctx.path.startsWith('/callback/') ||
      ctx.path.startsWith('/oauth2/callback/');
    const isSocialSignIn = ctx.path === '/sign-in/social';
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

    return ctx.redirect(`${frontendUrl}/two-factor`);
  });
