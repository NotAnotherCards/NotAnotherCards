import type { Database, SyncController } from '@remelondb/core';
import { updateUserProfile } from '@repo/offline-db';
import {
  type ProfileFormValues,
  usernameAvailabilitySchema,
} from '@repo/schemas';
import { authClient } from './auth-client';
import { apiURL } from './api-url';
import { apiErrorMessage } from './errors';

// The api owns username uniqueness (same endpoint web uses). Cookie handling
// as in lib/onboarding.ts: React Native's fetch has no cookie jar.
export async function checkUsernameAvailable(
  username: string,
): Promise<boolean> {
  const cookie = authClient.getCookie();
  let res: Response;
  try {
    res = await fetch(
      `${apiURL}/api/auth/check-username?username=${encodeURIComponent(username)}`,
      { headers: cookie ? { cookie } : {} },
    );
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
  const body = usernameAvailabilitySchema.safeParse(
    await res.json().catch(() => null),
  );
  if (!res.ok || !body.success) {
    throw new Error('Could not check the username. Try again.');
  }
  return body.data.available;
}

// The shared write plus the sync wake-up, the same shape as card-writes.
export function profileWrites(db: Database, sync: SyncController | null) {
  return {
    update: (values: ProfileFormValues) =>
      updateUserProfile(db, values).then((result) => {
        sync?.notifyLocalWrite();
        return result;
      }),
  };
}
