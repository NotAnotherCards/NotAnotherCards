import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  beginTwoFactorChallenge,
  hydrateTwoFactorChallenge,
} from '@/lib/two-factor-challenge';

export function TwoFactorLifecycle({
  deepLinkPending,
}: {
  deepLinkPending: boolean;
}) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const handledDeepLinkRef = useRef(false);

  useEffect(() => {
    if (deepLinkPending) {
      if (handledDeepLinkRef.current) return;
      handledDeepLinkRef.current = true;
      void beginTwoFactorChallenge().then(() => {
        routerRef.current.replace('/two-factor');
      });
      return;
    }

    // Removing an OAuth callback flag must not immediately replay the same
    // persisted challenge and replace the screen a second time.
    if (handledDeepLinkRef.current) {
      handledDeepLinkRef.current = false;
      return;
    }

    let active = true;
    void hydrateTwoFactorChallenge().then((challenge) => {
      if (active && challenge.pending) {
        routerRef.current.replace('/two-factor');
      }
    });
    return () => {
      active = false;
    };
  }, [deepLinkPending]);

  return null;
}
