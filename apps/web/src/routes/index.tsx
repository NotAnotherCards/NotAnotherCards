import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
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
      throw redirect({
        to: '/login',
      });
    }
  },
});
