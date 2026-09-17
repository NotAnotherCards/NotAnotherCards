import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api';

// Must equal the two-factor plugin's internal model name
// (`opts.twoFactorTable`, better-auth 1.6.26). See the shared comment in
// two-factor-oauth.hook.ts about coupling tripwires.
const TWO_FACTOR_MODEL = 'twoFactor';

/**
 * Better Auth's two-factor plugin replaces the secret unconditionally on
 * re-enable while carrying the old row's `verified` flag forward, so calling
 * /two-factor/enable again on an already-enrolled account silently rotates
 * the secret under a *verified* setup the user may not be able to reproduce.
 * This guard rejects re-enrollment until the existing setup is disabled.
 *
 * A stale row from an aborted first enrollment (`verified = false`) stays
 * restartable — same distinction the plugin itself applies.
 */
export const twoFactorReenrollmentGuard = () =>
  createAuthMiddleware(async (ctx) => {
    if (ctx.path !== '/two-factor/enable') return;

    const session = await getSessionFromCtx(ctx);
    if (!session) return; // unauthenticated requests are the endpoint's job

    const existing = await ctx.context.adapter.findOne<{
      verified?: boolean;
    } | null>({
      model: TWO_FACTOR_MODEL,
      where: [{ field: 'userId', value: session.user.id }],
    });

    if (existing && existing.verified !== false) {
      throw APIError.from('BAD_REQUEST', {
        code: 'TWO_FACTOR_ALREADY_ENABLED',
        message:
          'Two-factor authentication is already enabled for this account. Disable it before re-enrolling.',
      });
    }
  });
