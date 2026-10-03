import { useEffect, useRef, useState } from 'react';
import { authClient } from './auth-client';

let pending: Promise<void> | null = null;

// Expo 1.6.23 clears the session before AND after sign-out's HTTP request.
// Keep the entire operation as a barrier: a fresh login must follow both clears.
export function signOutForExpiredSyncSession() {
  pending ??= authClient
    .signOut()
    .then(
      () => {},
      () => {},
    )
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useSignOutBarrier() {
  const [signingOut, setSigningOut] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const waitForSignOut = async () => {
    if (pending) {
      setSigningOut(true);
      await pending;
      if (mounted.current) setSigningOut(false);
    }
    // Leaving the form while waiting must not submit a login later.
    return mounted.current;
  };
  return { signingOut, waitForSignOut };
}
