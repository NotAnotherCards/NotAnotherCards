import { createApiClient } from '@repo/api-client';
import { apiURL } from './api-url';
import { authClient } from './auth-client';

export const apiClient = createApiClient({
  baseUrl: apiURL,
  headers: (): Record<string, string> => {
    const cookie = authClient.getCookie();
    return cookie ? { cookie } : {};
  },
});
