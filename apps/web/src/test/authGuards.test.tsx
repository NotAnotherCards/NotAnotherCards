import { render, screen, act } from '@testing-library/react';
import { App, router } from '../App';
import { authClient } from '@/lib/auth-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@remelondb/core/react', () => ({
  useDatabaseState: () => ({ status: 'ready', error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
  // The root provider calls this, and the /app layout renders nothing
  // without a manager. These tests are about routing, not the database
  // lifecycle, so a stand-in is enough.
  useSessionDatabase: () => ({
    manager: { state: { status: 'ready', error: null } },
    syncController: null,
    closeError: null,
  }),
}));

describe('Auth Guards', () => {
  beforeEach(async () => {
    // Reset router history and path
    window.history.pushState(null, '', '/');
  });

  it('redirects logged-out users from dashboard to login', async () => {
    // Mock logged-out state
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

    render(<App />);

    // Try to navigate to dashboard
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    // Verify user is redirected to the login page (Welcome Back)
    expect(
      await screen.findByRole('heading', { name: /Welcome Back/i }),
    ).toBeInTheDocument();

    // Verify the URL is updated to /
    expect(window.location.pathname).toBe('/login');
  }, 15000);

  it('allows logged-in users to see the dashboard', async () => {
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

    render(<App />);

    // Navigate to dashboard
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    // Verify the dashboard route component is rendered
    expect(
      await screen.findByRole('heading', { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();

    // Verify welcome message with user name
    expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();

    // Verify the URL is /dashboard
    expect(window.location.pathname).toBe('/dashboard');
  }, 15000);

  it('redirects logged-in users away from the login page to the dashboard', async () => {
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

    render(<App />);

    // Try to navigate to login page
    await act(async () => {
      await router.navigate({ to: '/login' });
    });

    // Verify user is redirected to dashboard
    expect(
      await screen.findByRole('heading', { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();

    // Verify the URL is updated to /dashboard
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('redirects logged-out users from onboarding to login', async () => {
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

    // Set initial route to /login before rendering so that redirect to / is a real route change
    window.history.pushState(null, '', '/login');

    render(<App />);

    await act(async () => {
      await router.navigate({ to: '/onboarding' });
    });

    expect(window.location.pathname).toBe('/login');
  });

  it('renders 404 for /app without redirecting', async () => {
    render(<App />);

    await act(async () => {
      router.history.push('/app');
    });

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app');
  });

  it('renders 404 for /app/dashboard without redirecting', async () => {
    render(<App />);

    await act(async () => {
      router.history.push('/app/dashboard');
    });

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app/dashboard');
  });

  it('renders 404 for /app/onboarding without redirecting', async () => {
    render(<App />);

    await act(async () => {
      router.history.push('/app/onboarding');
    });

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app/onboarding');
  });

  it('renders error component on session fetch failure and allows retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockError = new Error('Network error');
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: mockError,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      isRefetching: false,
      error: mockError,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    render(<App />);

    // Try to navigate to dashboard
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    // Verify error component is rendered and redirect didn't happen
    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Session Error')).toBeInTheDocument();
    expect(window.location.pathname).not.toBe('/login');

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Mock next session fetch to succeed
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

    // Click retry
    await act(async () => {
      retryBtn.click();
    });

    // Check we made it to dashboard page
    expect(
      await screen.findByRole('heading', { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
  });
});
