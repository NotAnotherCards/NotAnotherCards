import { OnBoardingComponent } from '@/components/OnBoarding';
import { authClient } from '@/lib/auth-client';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: '/',
      });
    }
    const onboardingComplete = session.user.onBoardingComplete;
    if (onboardingComplete) {
      throw redirect({
        to: '/app/dashboard',
      });
    }
  },
  component: OnBoardingComponent,
});
