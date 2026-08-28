import { authClient } from '@/lib/auth-client';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { DatabaseBanner } from '@/components/DatabaseBanner';
import { SyncProvider } from '@/offline/syncProvider';
import { useSessionDatabase } from '@/offline/sessionDatabase';
import { SyncStatus } from '@/components/SyncStatus';

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
  const { manager, syncController } = useSessionDatabase();

  if (!manager) {
    return null;
  }

  return (
    <SyncProvider controller={syncController}>
      <div className="flex-1 flex flex-col bg-background">
        <DatabaseBanner />
        <SyncStatus />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
      </div>
    </SyncProvider>
  );
}
