import { toUiError, uiErrorText } from '@/lib/errors';
import { t } from 'i18next';
const apiErrorMessage = (error: unknown) => uiErrorText(toUiError(error), t);

describe('apiErrorMessage', () => {
  it.each([
    ['INVALID_EMAIL_OR_PASSWORD', 'auth.error.invalid_credentials'],
    ['INVALID_PASSWORD', 'dashboard.settings.two_factor.incorrect_password'],
    ['INVALID_EMAIL', 'auth.validation.invalid_email'],
    ['USER_ALREADY_EXISTS', 'auth.error.user_exists'],
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'auth.error.user_exists'],
    ['USERNAME_IS_ALREADY_TAKEN', 'dashboard.settings.profile.username_taken'],
    ['INVALID_TOKEN', 'auth.error.invalid_token'],
    ['TOKEN_EXPIRED', 'auth.error.invalid_token'],
    ['SESSION_EXPIRED', 'auth.error.session_expired'],
    ['SESSION_NOT_FRESH', 'auth.error.session_expired'],
    ['EMAIL_NOT_VERIFIED', 'auth.error.email_not_verified'],
    ['TOO_MANY_REQUESTS', 'auth.error.too_many_requests'],
  ])('maps auth code %s before the HTTP fallback', (code, key) => {
    expect(
      toUiError({ code, status: 401, message: 'not display copy' }).key,
    ).toBe(key);
    expect(toUiError({ body: { code }, status: 401 }).key).toBe(key);
  });
  it.each([
    [401, 'auth.error.session_expired'],
    [403, 'auth.error.forbidden'],
    [404, 'auth.error.not_found'],
    [429, 'auth.error.too_many_requests'],
    [503, 'mobile.messages.server_error'],
  ])('maps HTTP %s without leaking its message', (status, key) => {
    expect(toUiError({ status, message: 'private detail' }).key).toBe(key);
  });
  it('does not trust unknown codes or server-provided translation keys', () => {
    for (const code of ['__proto__', 'constructor', 'UNKNOWN']) {
      expect(
        toUiError({
          code,
          key: 'auth.error.invalid_credentials',
          message: 'private detail',
        }).key,
      ).toBe('auth.error.unexpected');
    }
  });
  it('maps Android connection failures to a friendly message', () => {
    expect(
      apiErrorMessage(
        new Error(
          'fetch failed: java.net.ConnectException: Failed to connect to /10.0.2.2:3000',
        ),
      ),
    ).toMatch(/Can't reach the server at http/);
  });

  it('maps the generic RN network error too', () => {
    expect(apiErrorMessage(new Error('Network request failed'))).toMatch(
      /Can't reach the server/,
    );
  });

  it('recognizes the legacy invalid-credentials message', () => {
    expect(apiErrorMessage({ message: 'Invalid email or password' })).toBe(
      'Invalid email or password',
    );
  });

  it('treats a caught connection failure (status 0, no message) as unreachable', () => {
    expect(apiErrorMessage({ status: 0, statusText: '' })).toMatch(
      /Can't reach the server/,
    );
  });

  it('names the status for a server error with an empty body', () => {
    expect(
      apiErrorMessage({ status: 500, statusText: '', message: null }),
    ).toBe('The server hit an error (HTTP 500) — check the API logs.');
  });

  it('does not expose server diagnostics', () => {
    expect(
      apiErrorMessage({ status: 500, message: 'Internal database error' }),
    ).toBe('The server hit an error (HTTP 500) — check the API logs.');
  });

  it('falls back when there is no message', () => {
    expect(apiErrorMessage({ message: null })).toBe(
      'An unexpected error occurred',
    );
    expect(apiErrorMessage(undefined)).toBe('An unexpected error occurred');
  });
});
