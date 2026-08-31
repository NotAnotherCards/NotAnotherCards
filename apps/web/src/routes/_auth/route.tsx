import { RouteErrorComponent } from '@/components/RouteErrorComponent';
import { authClient } from '@/lib/auth-client';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const { data: session, error } = await authClient.getSession();
    if (error) {
      throw error;
    }
    if (session) {
      const onboardingComplete = session.user.onBoardingComplete;
      if (!onboardingComplete) {
        throw redirect({
          to: '/onboarding',
        });
      }
      throw redirect({
        to: '/dashboard',
      });
    }
  },
  errorComponent: RouteErrorComponent,
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Outlet />
    </div>
  );
}
