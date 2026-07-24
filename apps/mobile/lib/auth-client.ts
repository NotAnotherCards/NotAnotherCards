import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import * as SecureStore from 'expo-secure-store'

// The API host differs per target: the Android emulator reaches the dev
// machine at 10.0.2.2, an iOS simulator at localhost. Set EXPO_PUBLIC_API_URL
// in .env.local to override; the fallback assumes the Android emulator.
const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000'

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: 'notanothercards',
      storagePrefix: 'notanothercards',
      storage: SecureStore,
    }),
    // Mirror the API's user.additionalFields so username/timezone are typed on
    // signUp and the session (matches apps/web/src/lib/auth-client.ts).
    inferAdditionalFields({
      user: {
        username: { type: 'string', required: true },
        timezone: { type: 'string', required: false, defaultValue: 'UTC' },
      },
    }),
  ],
})
