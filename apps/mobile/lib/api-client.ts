import { createApiClient } from '@repo/api-client';
import { fetch as expoFetch } from 'expo/fetch';
import { apiURL } from './api-url';
import { authClient } from './auth-client';

// The shared API calls with this app's transport: the API host, the
// session cookie read at every request (React Native's fetch has no cookie
// jar; Better Auth keeps the cookie in SecureStore, as lib/sync.ts and
// lib/onboarding.ts do), and expo/fetch, whose responses stream on Hermes
// so the moderation explanation can arrive piece by piece. The client
// only ever passes a URL string, a method, JSON body, headers and signal,
// which expo/fetch takes as the standard fetch does.
export const apiClient = createApiClient({
  baseUrl: apiURL,
  headers: (): Record<string, string> => {
    const cookie = authClient.getCookie();
    return cookie ? { cookie } : {};
  },
  fetch: (input, init) =>
    expoFetch(typeof input === 'string' ? input : input.toString(), {
      method: init?.method,
      body: init?.body as BodyInit | null | undefined,
      headers: init?.headers,
      signal: init?.signal,
    }),
});
