import { createAppSyncTransport, createHttpPost } from '@repo/offline-db';
import { apiURL } from './api-url';
import { authClient } from './auth-client';

export { SyncTransportError } from '@repo/offline-db';

// React Native's fetch has no cookie jar: Better Auth keeps the session
// cookie in SecureStore and getCookie() reads it locally. The headers
// thunk runs at the start of every request, so a logout or account
// switch is picked up without rebuilding the transport, and no session
// request is ever made. An empty cookie sends no header; the server's
// 401 is the signal.
export const { pullChanges, pushChanges } = createAppSyncTransport(
  createHttpPost({
    baseUrl: apiURL,
    headers: (): Record<string, string> => {
      const cookie = authClient.getCookie();
      return cookie ? { cookie } : {};
    },
  }),
);
