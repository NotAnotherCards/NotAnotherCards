import { authClient } from '@/lib/auth-client';
import { checkOnboardingComplete } from '@/offline/db';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      const onboardingComplete = await checkOnboardingComplete(session.user.id);
      if (!onboardingComplete) {
        throw redirect({
          to: '/app/onboarding',
        });
      }
      throw redirect({
        to: '/app/dashboard',
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Outlet />
    </div>
  );
}
