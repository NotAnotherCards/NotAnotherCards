import { createFileRoute, redirect } from '@tanstack/react-router';
import { HomeComponent } from '@/components/Home';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      const onboardingComplete = session.user.onBoardingComplete;
      if (onboardingComplete) {
        throw redirect({
          to: '/app/dashboard',
        });
      }
    }
  },
  component: HomeComponent,
});
