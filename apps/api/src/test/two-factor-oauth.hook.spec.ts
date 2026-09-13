import { isOAuthChallengePath } from '../auth/two-factor-oauth.hook';

// The e2e suite proves the full OAuth round-trip over the generic
// `/oauth2/callback/:providerId` route (loopback provider). Real Google and
// Facebook providers use the built-in `/callback/:id` route template, which
// e2e cannot reach without live provider traffic — this unit test pins the
// identical matcher branch for that production route shape.
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
