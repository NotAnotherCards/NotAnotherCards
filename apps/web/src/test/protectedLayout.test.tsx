import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, router } from '../App';
import { authClient } from '@/lib/auth-client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@remelondb/core/react', () => ({
  useDatabaseState: () => ({ status: 'ready', error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
  // The root provider calls this, and the  layout renders nothing
  // without a manager. These tests are about routing, not the database
  // lifecycle, so a stand-in is enough.
  useSessionDatabase: () => ({
    manager: { state: { status: 'ready', error: null } },
    syncController: null,
    closeError: null,
  }),
}));

vi.mock('@/offline/db', () => {
  const manager = {
    init: vi.fn().mockResolvedValue(undefined),
    state: { status: 'ready' },
    subscribe: vi.fn(() => () => {}),
  };
  return {
    manager,
    createUserDatabaseManager: vi.fn(() => manager),
    closeUserDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

const mockSession = {
  session: {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 3600000),
    token: 'token-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-123',
    email: 'user@example.com',
    name: 'John Doe',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    onBoardingComplete: true,
  },
};

// Verify that navigating to a protected route loads the layout along with nested pages like dashboard
describe('Protected Layout Guards', () => {
  beforeEach(() => {
    // Reset router history and path directly to the dashboard
    window.history.pushState(null, '', '/dashboard');

    // Mock logged-in state
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: mockSession,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);
  });

  afterEach(() => {});

  it('renders the protection wrapper on the dashboard page', async () => {
    render(<App />);
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });
    expect(
      await screen.findByRole('heading', { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
  });

  it('renders the persistent account menu trigger with user name and initials', async () => {
    render(<App />);
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    const accountTrigger = await screen.findByRole('button', {
      name: /Account menu/i,
    });
    expect(accountTrigger).toBeInTheDocument();
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('JD').length).toBeGreaterThan(0);
  });

  it('opens account menu with keyboard Enter/Space and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    const accountTrigger = await screen.findByRole('button', {
      name: /Account menu/i,
    });
    accountTrigger.focus();
    expect(accountTrigger).toHaveFocus();

    // Press Enter to open menu
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('menuitem', { name: /Log out/i }),
    ).toBeInTheDocument();

    // Press Escape to close menu
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menuitem', { name: /Log out/i })).toBeNull();
    expect(accountTrigger).toHaveFocus();
  });

  it('navigates to /login when clicking Log out in account menu', async () => {
    vi.mocked(authClient.signOut).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: null,
        error: null,
      });
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
        isRefetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof authClient.useSession>);
      return { data: null, error: null };
    });

    const user = userEvent.setup();
    render(<App />);
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    const accountTrigger = await screen.findByRole('button', {
      name: /Account menu/i,
    });
    await user.click(accountTrigger);

    const logoutItem = await screen.findByRole('menuitem', {
      name: /Log out/i,
    });
    await user.click(logoutItem);

    expect(authClient.signOut).toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: /Welcome Back/i }),
    ).toBeInTheDocument();
  });
});
