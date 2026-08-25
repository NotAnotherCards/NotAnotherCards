import { OnBoardingComponent } from '@/components/OnBoarding';
import { authClient } from '@/lib/auth-client';
import { checkOnboardingComplete } from '@/offline/db';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/app/onboarding')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      const onboardingComplete = await checkOnboardingComplete(session.user.id);
      if (onboardingComplete) {
        throw redirect({
          to: '/app/dashboard',
        });
      }
    }
  },
  component: OnBoardingComponent,
});
