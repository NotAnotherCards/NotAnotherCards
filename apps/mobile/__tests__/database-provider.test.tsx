import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import {
  SessionDatabaseProvider,
  useSessionDatabase,
} from '@/lib/database-provider';

// The lifecycle itself is remelonDB's (useSessionDatabase, tested
// upstream against real managers). What is app-level here is the wiring:
// which user id reaches the hook, which native pieces it is given, what
// lands on context, and what renders when a close has failed.
type SessionState = {
  data: { user: { id: string; onBoardingComplete?: boolean } } | null;
  isPending: boolean;
};

let mockSessionState: SessionState = { data: null, isPending: true };
jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockSessionState },
}));

const fakeManager = { tag: 'manager' };
const fakeController = { tag: 'controller' };
let hookResult: {
  manager: unknown;
  syncController: unknown;
  closeError: Error | null;
} = { manager: null, syncController: null, closeError: null };
const mockUseSessionDatabase = jest.fn((_options: unknown) => hookResult);

const mockDatabaseProvider = jest.fn(
  ({ children }: { manager: unknown; children: React.ReactNode }) => children,
);
jest.mock('@remelondb/core/react', () => ({
  DatabaseProvider: (props: { manager: unknown; children: React.ReactNode }) =>
    mockDatabaseProvider(props),
  useSessionDatabase: (options: unknown) => mockUseSessionDatabase(options),
}));

jest.mock('../lib/db', () => ({
  createUserDatabaseManager: jest.fn(() => fakeManager),
}));
jest.mock('../lib/sync', () => ({
  pullChanges: 'pull',
  pushChanges: 'push',
}));
jest.mock('../lib/sync-triggers', () => ({
  nativeSyncTriggers: 'triggers',
}));

function Consumer() {
  const { manager, syncController } = useSessionDatabase();
  return (
    <Text>
      {`${manager ? 'db' : 'no-db'}:${syncController ? 'sync' : 'no-sync'}`}
    </Text>
  );
}

const renderProvider = () =>
  render(
    <SessionDatabaseProvider>
      <Consumer />
    </SessionDatabaseProvider>,
  );

describe('SessionDatabaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionState = { data: null, isPending: true };
    hookResult = { manager: null, syncController: null, closeError: null };
  });

  it('passes no user while the session check is still running', () => {
    // useSession keeps the previous user visible while it refetches, so
    // a pending check must not open that user's database.
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: true,
    };
    renderProvider();

    expect(mockUseSessionDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  it('passes no user when signed out', () => {
    mockSessionState = { data: null, isPending: false };
    renderProvider();

    expect(mockUseSessionDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  it('gives the hook the signed-in user and the native pieces', () => {
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: false,
    };
    const { createUserDatabaseManager } = jest.requireMock('../lib/db');
    renderProvider();

    expect(mockUseSessionDatabase).toHaveBeenCalledWith({
      userId: 'user-a',
      createManager: createUserDatabaseManager,
      sync: { pullChanges: 'pull', pushChanges: 'push' },
      controller: { triggers: 'triggers' },
    });
  });

  it('puts the hook’s manager and controller on context', () => {
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
    // and the core provider gets the same manager, so queries resolve
    expect(mockDatabaseProvider).toHaveBeenCalledWith(
      expect.objectContaining({ manager: fakeManager }),
    );
  });

  it('mounts children before a manager exists', () => {
    // Blanking here would unmount the navigator, including the
    // signed-out screens, on every authenticated first paint.
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: true } },
      isPending: false,
    };
    renderProvider();

    expect(screen.getByText('no-db:no-sync')).toBeTruthy();
  });

  it('replaces the tree when a close has failed', () => {
    // Sticky by design: the database may still be open, so the hook will
    // not open another. There is no database to provide and nothing
    // worth showing without one, so this is not a banner.
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

    expect(screen.getByText('Restart the app')).toBeTruthy();
    expect(screen.getByText('driver refused to close')).toBeTruthy();
    expect(screen.queryByText('no-db:no-sync')).toBeNull();
  });

  it('passes no user until onboarding completed', () => {
    // The first pull expects the profile row the /onboard transaction
    // creates, so the account database stays closed until then.
    mockSessionState = {
      data: { user: { id: 'user-a', onBoardingComplete: false } },
      isPending: false,
    };
    renderProvider();

    expect(mockUseSessionDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });
});
