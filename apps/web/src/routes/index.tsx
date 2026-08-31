import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '@/lib/auth-client';
import { RouteErrorComponent } from '@/components/RouteErrorComponent';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data: session, error } = await authClient.getSession();
    if (error) {
      throw error
    }
    if (session) {
      const onboardingComplete = !!session.user.onBoardingComplete;
      if (onboardingComplete) {
        throw redirect({
          to: '/dashboard',
        });
      } else {
        throw redirect({
          to: '/onboarding',
        });
      }
    } else {
      if (session === null && error === null)
      throw redirect({
        to: '/login',
      });
    }
  },
  errorComponent: RouteErrorComponent
});
