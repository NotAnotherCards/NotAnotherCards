import { useEffect } from 'react';
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

  useEffect(() => {
    if (deepLinkPending) {
      void beginTwoFactorChallenge().then(() => {
        router.replace('/two-factor');
      });
      return;
    }
    let active = true;
    void hydrateTwoFactorChallenge().then((challenge) => {
      if (active && challenge.pending) router.replace('/two-factor');
    });
    return () => {
      active = false;
    };
  }, [deepLinkPending, router]);

  return null;
}
