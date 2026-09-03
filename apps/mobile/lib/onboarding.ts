import type { ProfileFormValues } from '@repo/schemas';
import { authClient } from './auth-client';
import { apiURL } from './api-url';
import { apiErrorMessage } from './errors';

// Online-only: the API owns username uniqueness and sets
// user.onBoardingComplete in the same transaction as the profile upsert,
// so a local-only write cannot complete onboarding (see #179).
export async function completeOnboarding(
  values: ProfileFormValues,
): Promise<void> {
  // React Native's fetch has no cookie jar; Better Auth keeps the session
  // cookie in SecureStore and getCookie() reads it locally (same pattern
  // as lib/sync.ts).
  const cookie = authClient.getCookie();
  let res: Response;
  try {
    res = await fetch(`${apiURL}/api/auth/onboard`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(values),
    });
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : undefined;
    throw new Error(message || apiErrorMessage({ status: res.status }));
  }
}
