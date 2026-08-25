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
  },
};

vi.mock('@remelondb/core/react', () => ({
  useDatabaseState: () => ({ status: 'ready', error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
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
      await router.navigate({ to: '/app/dashboard' });
    });

    // Verify user is redirected to the login page
    expect(
      await screen.findByRole('heading', { name: /Welcome Back/i }),
    ).toBeInTheDocument();

    // Verify the URL is updated to /login
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
      await router.navigate({ to: '/app/dashboard' });
    });

    // Verify the dashboard route component is rendered
    expect(
      await screen.findByRole('heading', { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();

    // Verify welcome message with user name
    expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();

    // Verify the URL is /app/dashboard
    expect(window.location.pathname).toBe('/app/dashboard');
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

    // Verify the URL is updated to /app/dashboard
    expect(window.location.pathname).toBe('/app/dashboard');
  });

  it('redirects logged-out users from onboarding to home', async () => {
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
      await router.navigate({ to: '/app/onboarding' });
    });

    expect(window.location.pathname).toBe('/');
  });

  it('redirects logged-out users from /app to home', async () => {
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
      await router.navigate({ to: '/app' });
    });

    expect(window.location.pathname).toBe('/');
  });

  it('redirects logged-in users from /app to dashboard', async () => {
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

    // Set initial route to /login before rendering so that redirect to /app/dashboard is a real route change
    window.history.pushState(null, '', '/login');

    render(<App />);

    await act(async () => {
      await router.navigate({ to: '/app' });
    });

    expect(window.location.pathname).toBe('/app/dashboard');
  });
});
