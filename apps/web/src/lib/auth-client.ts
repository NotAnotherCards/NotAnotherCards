import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [
    inferAdditionalFields({
      user: {
        timezone: {
          type: 'string',
          required: false,
          defaultValue: 'UTC',
        },
        onBoardingComplete: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
      },
    }),
  ],
});
