import { authClient } from '@/lib/auth-client';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
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
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Outlet />
    </div>
  );
}
