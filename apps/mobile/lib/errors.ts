import type { TFunction } from 'i18next';
import { apiURL } from './api-url';

// Keep a key, not a translated string, even when an error crosses an async
// helper before reaching the screen. Only locally constructed errors bypass
// the server-error mapping.
export class UiError extends Error {
  constructor(
    readonly key: string,
    readonly params?: Record<string, string | number | UiError>,
  ) {
    super(key);
    this.name = 'UiError';
  }
}

export function uiErrorText(error: UiError, t: TFunction): string {
  const params = Object.fromEntries(
    Object.entries(error.params ?? {}).map(([key, value]) => [
      key,
      value instanceof UiError ? uiErrorText(value, t) : value,
    ]),
  );
  return t(error.key, params);
}

const AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'auth.error.invalid_credentials',
  INVALID_PASSWORD: 'dashboard.settings.two_factor.incorrect_password',
  INVALID_EMAIL: 'auth.validation.invalid_email',
  USER_ALREADY_EXISTS: 'auth.error.user_exists',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'auth.error.user_exists',
  USERNAME_IS_ALREADY_TAKEN: 'dashboard.settings.profile.username_taken',
  INVALID_TOKEN: 'auth.error.invalid_token',
  TOKEN_EXPIRED: 'auth.error.invalid_token',
  SESSION_EXPIRED: 'auth.error.session_expired',
  SESSION_NOT_FRESH: 'auth.error.session_expired',
  EMAIL_NOT_VERIFIED: 'auth.error.email_not_verified',
  TOO_MANY_REQUESTS: 'auth.error.too_many_requests',
};

export function toUiError(err: unknown): UiError {
  if (err instanceof UiError) return err;
  const obj =
    err !== null && typeof err === 'object'
      ? (err as {
          message?: unknown;
          status?: unknown;
          code?: unknown;
          body?: unknown;
        })
      : undefined;
  const body =
    obj?.body && typeof obj.body === 'object'
      ? (obj.body as { code?: unknown; message?: unknown })
      : undefined;
  const code = typeof obj?.code === 'string' ? obj.code : body?.code;
  if (typeof code === 'string' && typeof AUTH_ERRORS[code] === 'string')
    return new UiError(AUTH_ERRORS[code]);
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : obj && 'message' in obj
          ? String(obj.message ?? '')
          : typeof body?.message === 'string'
            ? body.message
            : '';
  if (
    obj?.status === 0 ||
    /fetch failed|network request failed|failed to connect|econnrefused/i.test(
      message,
    )
  ) {
    return new UiError('mobile.messages.network_error', { url: apiURL });
  }
  // Older auth responses and the controller's serialized sync error may
  // retain only these messages. Never display arbitrary server text.
  if (message === 'Invalid email or password')
    return new UiError('auth.error.invalid_credentials');
  if (
    message === 'Username is already taken' ||
    message === 'Username already taken'
  )
    return new UiError('dashboard.settings.profile.username_taken');
  if (obj?.status === 401 || message === 'Unauthorized')
    return new UiError('auth.error.session_expired');
  if (obj?.status === 403) return new UiError('auth.error.forbidden');
  if (obj?.status === 404) return new UiError('auth.error.not_found');
  if (obj?.status === 429) return new UiError('auth.error.too_many_requests');
  if (typeof obj?.status === 'number' && obj.status >= 500) {
    return new UiError('mobile.messages.server_error', { status: obj.status });
  }
  return new UiError('auth.error.unexpected');
}

// The shared queries surface low-level failures ("Database not initialized").
// Keep that message, since it is the only clue the user gets, but fall back to
// something readable when the rejection carries none. Web has the same five
// lines in its own lib; how a form phrases a failure is each client's call.
// The database's own message is language-neutral detail and stays text; the
// fallback stays a key so it follows a language switch.
export type WriteError = string | UiError;
export const toWriteError = (err: unknown, fallbackKey: string): WriteError =>
  err instanceof UiError
    ? err
    : err instanceof Error && err.message
      ? err.message
      : new UiError(fallbackKey);
export const writeErrorText = (error: WriteError, t: TFunction) =>
  typeof error === 'string' ? error : uiErrorText(error, t);
