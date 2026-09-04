import { apiURL } from './api-url';

// better-auth reports HTTP errors through its { error } result (status 0 and
// no message when the connection itself failed), but can also throw a raw
// fetch error like "java.net.ConnectException: Failed to connect to
// /10.0.2.2:3000". Map all of them onto something a person can act on.
export function apiErrorMessage(err: unknown): string {
  const obj =
    err !== null && typeof err === 'object'
      ? (err as { message?: unknown; status?: unknown })
      : undefined;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : obj && 'message' in obj
          ? String(obj.message ?? '')
          : '';
  if (
    obj?.status === 0 ||
    /fetch failed|network request failed|failed to connect|econnrefused/i.test(
      message,
    )
  ) {
    return `Can't reach the server at ${apiURL} — is the API running?`;
  }
  if (!message && typeof obj?.status === 'number' && obj.status >= 500) {
    return `The server hit an error (HTTP ${obj.status}) — check the API logs.`;
  }
  return message || 'An unexpected error occurred';
}

// The shared queries surface low-level failures ("Database not initialized").
// Keep that message, since it is the only clue the user gets, but fall back to
// something readable when the rejection carries none. Web has the same five
// lines in its own lib; how a form phrases a failure is each client's call.
export const writeErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;
