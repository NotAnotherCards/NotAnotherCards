import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';
import { apiURL } from './api-url';

export const authClient = createAuthClient({
  baseURL: apiURL,
  plugins: [
    expoClient({
      scheme: 'notanothercards',
      storagePrefix: 'notanothercards',
      storage: SecureStore,
    }),
    // Mirror the API's user.additionalFields so timezone is typed on
    // signUp and the session (matches apps/web/src/lib/auth-client.ts).
    inferAdditionalFields({
      user: {
        timezone: { type: 'string', required: false, defaultValue: 'UTC' },
      },
    }),
  ],
});
