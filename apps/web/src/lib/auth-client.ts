import { usernameAvailabilitySchema } from '@repo/schemas';
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
          type: 'boolean',
          required: false,
          defaultValue: false,
        },
      },
    }),
  ],
});

export async function checkUsernameAvailable(
  username: string,
): Promise<boolean> {
  const res = await fetch(
    `/api/auth/check-username?username=${encodeURIComponent(username)}`,
  );
  if (!res.ok) {
    throw new Error('Failed to check username availability');
  }
  const body = usernameAvailabilitySchema.safeParse(await res.json());
  if (!body.success) {
    throw new Error('Failed to check username availability');
  }
  return body.data.available;
}
