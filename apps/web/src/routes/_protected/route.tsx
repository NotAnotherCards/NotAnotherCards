import { authClient } from '@/lib/auth-client';
import {
  createFileRoute,
  redirect,
} from '@tanstack/react-router';
import { RouteErrorComponent } from '@/components/RouteErrorComponent';
import { ProtectedLayoutComponent } from '@/components/ProtectedRouteComponent';

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ location }) => {
    const { data: session, error } = await authClient.getSession();
    if (error) {
      throw error;
    }
    if (!session) {
      throw redirect({
        to: '/login',
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