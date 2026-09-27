import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import {
  inferAdditionalFields,
  twoFactorClient,
} from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';
import { apiURL } from './api-url';
import { AUTH_STORAGE_PREFIX } from './auth-storage';

export const authClient = createAuthClient({
  baseURL: apiURL,
  plugins: [
    expoClient({
      scheme: 'notanothercards',
      storagePrefix: AUTH_STORAGE_PREFIX,
      storage: SecureStore,
    }),
    // Mirror the API's user.additionalFields so timezone is typed on
    // signUp and the session (matches apps/web/src/lib/auth-client.ts).
    twoFactorClient(),
    inferAdditionalFields({
      user: {
        timezone: { type: 'string', required: false, defaultValue: 'UTC' },
        onBoardingComplete: {
          type: 'boolean',
          required: false,
          defaultValue: false,
        },
      },
    }),
  ],
});
