import { render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, router } from '../App';
import { authClient } from '@/lib/auth-client';

/**
 * The session database owner must live above the router. Its close queue
 * lives as long as the component calling the hook, so if it were moved
 * into the /app layout — which TanStack destroys and rebuilds on every
 * navigation — the queue would be discarded exactly when it is needed.
 *
 * This counts hook mounts across real navigation rather than re-renders
 * in place, which is what makes it catch that move.
 */
let mounts = 0;
let unmounts = 0;

vi.mock('@remelondb/core/react', async () => {
  const { useEffect } = await import('react');
  return {
    useDatabaseState: () => ({ status: 'ready', error: null }),
    useQuery: () => ({ data: [], isLoading: false, error: null }),
    useDatabase: () => null,
    DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
    useSessionDatabase: () => {
      useEffect(() => {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      }, []);
      return {
        manager: { state: { status: 'ready', error: null } },
        syncController: null,
        closeError: null,
      };
    },
  };
});

vi.mock('@/offline/db', () => ({
  createUserDatabaseManager: vi.fn(),
}));

const onboardedSession = {
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

describe('session database owner lifetime', () => {
  beforeEach(async () => {
    mounts = 0;
    unmounts = 0;
    window.history.pushState(null, '', '/dashboard');
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: onboardedSession,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: onboardedSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);
    await act(async () => {
      await router.invalidate();
    });
  });

  it('survives the /app layout being unmounted and rebuilt', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
    expect(mounts).toBe(1);

    // Sign out: the /app guard sends the user to '/', which unmounts the
    // /app layout. Every other route bounces a signed-in user back to
    // /app, so this is the way that layout actually goes away.
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClient.getSession>>);
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);
    await act(async () => {
      await router.invalidate();
      await router.navigate({ to: '/dashboard' });
    });

    // Sign back in.
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: onboardedSession,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: onboardedSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);
    await act(async () => {
      await router.invalidate();
      await router.navigate({ to: '/dashboard' });
    });

    // Mounted in __root, the owner never went away, so its close queue
    // is still the one the next open waits on. Mounted in the /app
    // layout, this would be two mounts and one unmount, and the queue
    // would have been discarded between them.
    expect(unmounts).toBe(0);
    expect(mounts).toBe(1);
  });
});
