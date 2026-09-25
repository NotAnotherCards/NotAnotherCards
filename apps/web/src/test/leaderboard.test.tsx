import { render, screen, act } from '@testing-library/react';
import { App, router } from '../App';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

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
    email: 'john.doe@example.com',
    name: 'John Doe',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    onBoardingComplete: true,
  },
};

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@remelondb/core/react', () => ({
  useDatabaseState: () => ({ status: 'ready', error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
  useSessionDatabase: () => ({
    manager: { state: { status: 'ready', error: null } },
    syncController: null,
    closeError: null,
  }),
}));

describe('Leaderboard Component Specs', () => {
  beforeEach(async () => {
    window.history.pushState(null, '', '/dashboard');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        limit: 20,
        offset: 0,
        currentUser: {
          rank: 42,
          username: 'John Doe',
          points: 10,
          isCurrentUser: true,
        },
        entries: [
          { rank: 1, username: 'Alice', points: 100, isCurrentUser: false },
          { rank: 2, username: 'Bob', points: 90, isCurrentUser: false },
        ],
      }),
    } as Response);

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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the leaderboard tab correctly and lists users', async () => {
    const user = userEvent.setup();
    render(<App />);

    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    const leaderboardTab = await screen.findByRole('tab', {
      name: /Leaderboard/i,
    });
    await user.click(leaderboardTab);

    // Verify information
    expect(await screen.findByText(/How scoring works/i)).toBeInTheDocument();

    // Verify top users are displayed
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(await screen.findByText('Bob')).toBeInTheDocument();

    // Current user that is outside the first page should be rendered
    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(await screen.findByText('You')).toBeInTheDocument();
  });
});
