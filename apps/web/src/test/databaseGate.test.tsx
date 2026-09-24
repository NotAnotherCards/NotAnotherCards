import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as remelonReact from '@remelondb/core/react';
import { ProtectedLayoutComponent } from '../components/ProtectedRouteComponent';

vi.mock('@remelondb/core/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remelondb/core/react')>();
  return { ...actual, useDatabaseState: vi.fn() };
});
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div>outlet</div>,
  useLocation: () => ({ pathname: '/dashboard' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/offline/sessionDatabase', () => ({
  useSessionDatabase: () => ({ manager: {}, syncController: null }),
}));
vi.mock('@/offline/syncProvider', () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/SyncStatus', () => ({ SyncStatus: () => null }));
vi.mock('@/components/DatabaseBanner', () => ({
  DatabaseBanner: () => <div>banner</div>,
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: 'Jane Doe' } } }),
    signOut: vi.fn(),
  },
}));

describe('ProtectedLayoutComponent database gate', () => {
  it('renders the route while the database is fine', () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: 'ready',
      error: null,
    });
    render(<ProtectedLayoutComponent />);
    expect(screen.getByText('outlet')).toBeInTheDocument();
  });

  it('leaves the banner as the only report of a failed open', () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: 'error',
      error: new Error('NoModificationAllowedError'),
    });
    render(<ProtectedLayoutComponent />);
    expect(screen.getByText('banner')).toBeInTheDocument();
    expect(screen.queryByText('outlet')).toBeNull();
  });
});
