import { authClient } from '@/lib/auth-client';
import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from '@tanstack/react-router';
import { DatabaseBanner } from '@/components/DatabaseBanner';
import { SyncProvider } from '@/offline/syncProvider';
import { useSessionDatabase } from '@/offline/sessionDatabase';
import { SyncStatus } from '@/components/SyncStatus';
import { RouteErrorComponent } from '@/components/RouteErrorComponent';

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ location }) => {
    const { data: session, error } = await authClient.getSession();
    if (error) {
      throw error
    }
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
  errorComponent: RouteErrorComponent,
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { manager, syncController } = useSessionDatabase();
  const location = useLocation();

  if (!manager && location.pathname !== '/onboarding') {
    return null;
  }

  return (
    <SyncProvider controller={syncController}>
      <div className="flex-1 flex flex-col bg-background">
        {manager && <DatabaseBanner />}
        <SyncStatus />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
      </div>
    </SyncProvider>
  );
}
