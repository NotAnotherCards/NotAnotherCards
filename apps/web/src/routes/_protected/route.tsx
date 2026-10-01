import { authClient } from '@/lib/auth-client';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { RouteErrorComponent } from '@/components/RouteErrorComponent';
import { ProtectedLayoutComponent } from '@/components/ProtectedRouteComponent';
import {
  pendingChallengeReturnTo,
  rememberPendingChallenge,
  safeReturnTo,
} from '@/lib/two-factor-challenge';

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ location }) => {
    const { data: session, error } = await authClient.getSession();
    if (error) {
      throw error;
    }
    if (!session) {
      const searchParams = new URLSearchParams(location.searchStr);
      const returnTo = safeReturnTo(
        `${location.pathname}${location.searchStr}${location.hash}`,
      );
      if (
        searchParams.get('twoFactorRequired') === 'true' ||
        pendingChallengeReturnTo()
      ) {
        rememberPendingChallenge(returnTo);
        throw redirect({
          to: '/two-factor',
          search: { redirect: returnTo },
          replace: true,
        });
      }
      throw redirect({
        to: '/login',
        search: { redirect: returnTo },
      });
    } else {
      const onBoardingComplete = session.user.onBoardingComplete;
      if (!onBoardingComplete) {
        if (location.pathname !== '/onboarding') {
          throw redirect({
            to: '/onboarding',
          });
        }
      } else {
        if (location.pathname === '/onboarding') {
          throw redirect({
            to: '/dashboard',
          });
        }
      }
    }
  },
  errorComponent: RouteErrorComponent,
  component: ProtectedLayoutComponent,
});
