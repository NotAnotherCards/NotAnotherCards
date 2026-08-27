import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  SessionDatabaseProvider,
  useSessionDatabase,
} from '@/offline/sessionDatabase';

// The lifecycle is remelonDB's (useSessionDatabase, tested upstream
// against real managers). What is app-level is the wiring: which user id
// reaches the hook, which browser pieces it gets, what lands on context,
// and what renders when a close has failed.
type SessionState = {
  data: { user: { id: string; onBoardingComplete?: boolean } } | null;
  isPending: boolean;
};

let mockSessionState: SessionState = { data: null, isPending: true };
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => mockSessionState },
}));

const fakeManager = { tag: 'manager' };
const fakeController = { tag: 'controller' };
let hookResult: {
  manager: unknown;
  syncController: unknown;
  closeError: Error | null;
} = { manager: null, syncController: null, closeError: null };
const mockUseSessionDatabase = vi.fn((options: unknown) => {
  void options;
  return hookResult;
});
const mockDatabaseProvider = vi.fn(
  ({ children }: { manager: unknown; children: React.ReactNode }) => children,
);

vi.mock('@remelondb/core/react', () => ({
  DatabaseProvider: (props: { manager: unknown; children: React.ReactNode }) =>
    mockDatabaseProvider(props),
  useSessionDatabase: (options: unknown) => mockUseSessionDatabase(options),
}));

vi.mock('@/offline/db', () => ({
  createUserDatabaseManager: vi.fn(),
}));
vi.mock('@/offline/sync', () => ({
  pullChanges: 'pull',
  pushChanges: 'push',
}));
vi.mock('@/offline/syncController', () => ({
  browserSyncTriggers: 'triggers',
}));

function Consumer() {
  const { manager, syncController } = useSessionDatabase();
  return (
    <span>
      {`${manager ? 'db' : 'no-db'}:${syncController ? 'sync' : 'no-sync'}`}
    </span>
  );
}

const renderProvider = () =>
  render(
    <SessionDatabaseProvider>
      <Consumer />
    </SessionDatabaseProvider>,
  );

const optionsPassed = () =>
  mockUseSessionDatabase.mock.calls.at(-1)?.[0] as { userId: string | null };

describe('SessionDatabaseProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = { data: null, isPending: true };
    hookResult = { manager: null, syncController: null, closeError: null };
  });

  it('passes no user while the session check is still running', () => {
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: true,
    };
    renderProvider();

    expect(optionsPassed().userId).toBeNull();
  });

  it('passes no user when signed out', () => {
    mockSessionState = { data: null, isPending: false };
    renderProvider();

    expect(optionsPassed().userId).toBeNull();
  });

  it('passes no user before onboarding is complete', () => {
    // The database used to be opened by the /app layout, behind a guard
    // that checked this. From the root there is no guard in front.
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: false } },
      isPending: false,
    };
    renderProvider();

    expect(optionsPassed().userId).toBeNull();
  });

  it('gives the hook the onboarded user and the browser pieces', async () => {
    const { createUserDatabaseManager } = await import('@/offline/db');
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: false,
    };
    renderProvider();

    expect(mockUseSessionDatabase).toHaveBeenCalledWith({
      userId: 'user-a',
      createManager: createUserDatabaseManager,
      sync: { pullChanges: 'pull', pushChanges: 'push' },
      controller: { triggers: 'triggers' },
    });
  });

  it('puts the manager and controller on context and into DatabaseProvider', () => {
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: false,
    };
    hookResult = {
      manager: fakeManager,
      syncController: fakeController,
      closeError: null,
    };
    renderProvider();

    expect(screen.getByText('db:sync')).toBeTruthy();
    expect(mockDatabaseProvider).toHaveBeenCalledWith(
      expect.objectContaining({ manager: fakeManager }),
    );
  });

  it('renders children before a manager exists', () => {
    // Blanking here would unmount the router on every authenticated
    // first paint.
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: false,
    };
    renderProvider();

    expect(screen.getByText('no-db:no-sync')).toBeTruthy();
    expect(mockDatabaseProvider).not.toHaveBeenCalled();
  });

  it('replaces the tree when a close has failed', () => {
    // Sticky by design: the database may still be open, so the hook will
    // not open another. Navigation cannot clear it and there is no
    // database to provide, so this is not a banner.
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: false,
    };
    hookResult = {
      manager: null,
      syncController: null,
      closeError: new Error('driver refused to close'),
    };
    renderProvider();

    expect(screen.getByText('Reload to continue')).toBeTruthy();
    expect(screen.getByText('driver refused to close')).toBeTruthy();
    expect(screen.queryByText('no-db:no-sync')).toBeNull();
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      /requires SessionDatabaseProvider/,
    );
  });
});
