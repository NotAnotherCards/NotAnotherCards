import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedLayoutComponent } from '../components/ProtectedRouteComponent';

// A new account has no offline database until onboarding is done, so the
// layout renders /onboarding with no manager and no DatabaseProvider. The
// remelonDB hooks are left real here: they throw without a provider, which
// is what an unguarded database read in the layout runs into.
// onboarding.test.tsx covers the same page with a useStore that throws;
// keeping the real hooks also catches a read that bypasses useStore, such
// as a direct useQuery or useDatabaseState call.
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div>onboarding form</div>,
  useLocation: () => ({ pathname: '/onboarding' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/offline/sessionDatabase', () => ({
  useSessionDatabase: () => ({ manager: null, syncController: null }),
}));
vi.mock('@/offline/syncProvider', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/offline/syncProvider')>();
  return {
    ...actual,
    SyncProvider: ({ children }: { children: React.ReactNode }) => children,
    useSyncController: vi.fn(() => null),
    useSyncState: vi.fn(() => ({ status: 'idle' })),
  };
});
vi.mock('@/components/SyncStatus', () => ({ SyncStatus: () => null }));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: 'new-user', name: 'New User' } },
    }),
    signOut: vi.fn(),
  },
}));

describe('ProtectedLayoutComponent before onboarding', () => {
  it('renders onboarding for a new account without a database', () => {
    render(<ProtectedLayoutComponent />);
    expect(screen.getByText('onboarding form')).toBeInTheDocument();
  });
});
