import { authClient } from '@/lib/auth-client';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { DatabaseBanner } from '@/components/DatabaseBanner';
import { SyncProvider } from '@/offline/syncProvider';
import { useSessionDatabase } from '@/offline/sessionDatabase';
import { SyncStatus } from '@/components/SyncStatus';

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: '/',
      });
    }

    const onboardingComplete = !!session.user.onBoardingComplete;

    if (!onboardingComplete) {
      throw redirect({
        to: '/onboarding',
      });
    }

    if (location.pathname === '/app') {
      throw redirect({
        to: '/app/dashboard',
      });
    }

    return {
      session,
    };
  },
  component: AppLayout,
});

function AppLayout() {
  // The database is owned by the provider in __root.tsx, above the
  // router. This layout only consumes it: it is destroyed and rebuilt on
  // navigation, which is exactly why it must not own the lifecycle.
  const { manager, syncController } = useSessionDatabase();

  if (!manager) {
    return null;
  }

  // No DatabaseProvider here: the root provider already supplies the
  // manager to this subtree.
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
