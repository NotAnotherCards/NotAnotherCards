import { authClient } from '@/lib/auth-client';
import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { DatabaseBanner } from '@/components/DatabaseBanner';
import { SyncProvider } from '@/offline/syncProvider';
import { useSessionDatabase } from '@/offline/sessionDatabase';
import { SyncStatus } from '@/components/SyncStatus';
import { RouteErrorComponent } from '@/components/RouteErrorComponent';
import { LogOut, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ location }) => {
    const { data: session, error } = await authClient.getSession();
    if (error) {
      throw error;
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
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  if (!manager && location.pathname !== '/onboarding') {
    return null;
  }

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U');

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      void navigate({ to: '/login' });
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <SyncProvider controller={syncController}>
      <div className="flex-1 flex flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-end px-4 py-2 border-b border-border/40 bg-background/80 backdrop-blur-xs">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="flex items-center gap-2 rounded-full p-1 sm:px-3 sm:py-1.5 hover:bg-accent/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer border border-border/40"
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name || 'User avatar'}
                  className="size-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="size-8 rounded-full bg-linear-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-xs shadow-xs shrink-0">
                  {initials}
                </div>
              )}
              <span className="hidden sm:inline-block font-medium text-sm text-foreground truncate max-w-40">
                {user?.name || user?.email}
              </span>
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
              >
                <LogOut className="size-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {manager && <DatabaseBanner />}
        <SyncStatus />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
      </div>
    </SyncProvider>
  );
}
