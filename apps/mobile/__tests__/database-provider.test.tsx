import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import {
  SessionDatabaseProvider,
  useSessionDatabase,
} from '@/lib/database-provider';

type SessionState = {
  data: { user: { id: string } } | null;
  isPending: boolean;
};

type FakeManager = {
  owner: string;
  init: jest.Mock;
  close: jest.Mock;
  state: { status: string; error: null };
  subscribe: jest.Mock;
  emit: () => void;
};

let mockSessionState: SessionState = { data: null, isPending: true };
const mockUseSession = jest.fn(() => mockSessionState);
const mockCreateUserDatabaseManager = jest.fn((userId: string) =>
  makeManager(userId),
);

jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession() },
}));

const mockCreateRunSync = jest.fn(() => async () => ({
  resynced: false,
  rejected: 0,
  rejectedRecords: {},
}));
type FakeSyncController = {
  start: jest.Mock;
  dispose: jest.Mock;
  disposedAt: number[];
};
const disposeOrder: string[] = [];
const madeControllers: FakeSyncController[] = [];
const mockCreateSyncController = jest.fn(() => {
  const controller: FakeSyncController = {
    start: jest.fn(),
    dispose: jest.fn(() => disposeOrder.push('dispose')),
    disposedAt: [],
  };
  madeControllers.push(controller);
  return controller;
});
jest.mock('@remelondb/core', () => ({
  ...jest.requireActual('@remelondb/core'),
  createRunSync: (...args: unknown[]) => mockCreateRunSync(...(args as [])),
  createSyncController: () => mockCreateSyncController(),
}));
jest.mock('../lib/sync', () => ({
  pullChanges: jest.fn(),
  pushChanges: jest.fn(),
}));
jest.mock('../lib/sync-triggers', () => ({
  nativeSyncTriggers: () => () => {},
}));

jest.mock('../lib/db', () => ({
  createUserDatabaseManager: (userId: string) =>
    mockCreateUserDatabaseManager(userId),
}));

// Mirrors the real manager's contract: subscribe emits the current state at
// once and again on every change, and a settled init() leaves the manager
// ready or in error.
function makeManager(
  owner: string,
  init: Promise<unknown> = Promise.resolve({}),
): FakeManager {
  const listeners = new Set<(state: FakeManager['state']) => void>();
  const emit = () => listeners.forEach((listener) => listener(manager.state));
  const manager = {
    owner,
    database: {},
    state: { status: 'idle', error: null },
    init: jest.fn(() =>
      init.then(
        (database) => {
          manager.state = { status: 'ready', error: null };
          emit();
          return database;
        },
        (error: unknown) => {
          manager.state = { status: 'error', error: null };
          emit();
          throw error;
        },
      ),
    ),
    close: jest.fn(() => {
      disposeOrder.push('close');
      manager.state = { status: 'idle', error: null };
      return Promise.resolve(undefined);
    }),
    emit,
    subscribe: jest.fn((listener: (state: FakeManager['state']) => void) => {
      listeners.add(listener);
      listener(manager.state);
      return () => {
        listeners.delete(listener);
      };
    }),
  } as unknown as FakeManager;
  return manager;
}

function ActiveOwner() {
  const { manager } = useSessionDatabase();
  return (
    <Text>{manager ? (manager as unknown as FakeManager).owner : 'none'}</Text>
  );
}

function renderProvider() {
  return render(
    <SessionDatabaseProvider>
      <ActiveOwner />
    </SessionDatabaseProvider>,
  );
}

describe('SessionDatabaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disposeOrder.length = 0;
    madeControllers.length = 0;
    mockSessionState = { data: null, isPending: true };
    mockCreateUserDatabaseManager.mockImplementation((userId: string) =>
      makeManager(userId),
    );
  });

  it('waits for an authenticated session before creating a manager', () => {
    const { getByText } = renderProvider();

    expect(getByText('none')).toBeTruthy();
    expect(mockCreateUserDatabaseManager).not.toHaveBeenCalled();
  });

  it('creates no manager while the session check is still pending', () => {
    // useSession can keep the previous user while it refetches, so a user id
    // alone is not enough; only isPending === false means the check finished.
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: true,
    };

    const { getByText } = renderProvider();

    expect(getByText('none')).toBeTruthy();
    expect(mockCreateUserDatabaseManager).not.toHaveBeenCalled();
  });

  it('mounts children on an authenticated first paint, before the manager exists', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };
    // The manager is created in the provider's effect. If the tree blanked
    // while userId is set and the manager missing, children could only mount
    // after that effect ran; mounting before it proves the navigator is
    // never unmounted. Child effects run before parent effects, so mount
    // order is observable through invocationCallOrder.
    const childMounted = jest.fn();
    function MountProbe() {
      React.useEffect(() => childMounted(), []);
      return <Text>probe</Text>;
    }

    const view = render(
      <SessionDatabaseProvider>
        <MountProbe />
      </SessionDatabaseProvider>,
    );

    await waitFor(() => expect(view.getByText('probe')).toBeTruthy());
    expect(childMounted).toHaveBeenCalled();
    expect(mockCreateUserDatabaseManager).toHaveBeenCalled();
    expect(childMounted.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateUserDatabaseManager.mock.invocationCallOrder[0],
    );
  });

  it('creates and initializes the authenticated user manager', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };

    const { getByText } = renderProvider();

    await waitFor(() => expect(getByText('user-a')).toBeTruthy());
    const manager = mockCreateUserDatabaseManager.mock.results[0]
      .value as FakeManager;
    expect(mockCreateUserDatabaseManager).toHaveBeenCalledWith('user-a');
    expect(manager.init).toHaveBeenCalled();
  });

  it('closes the old account and ignores its late initialization', async () => {
    let resolveFirstInit!: (value: unknown) => void;
    const firstInit = new Promise((resolve) => {
      resolveFirstInit = resolve;
    });
    const firstManager = makeManager('user-a', firstInit);
    const secondManager = makeManager('user-b');
    mockCreateUserDatabaseManager
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(secondManager);
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };

    const view = renderProvider();
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy());

    mockSessionState = {
      data: { user: { id: 'user-b' } },
      isPending: false,
    };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    await waitFor(() => expect(view.getByText('user-b')).toBeTruthy());
    expect(firstManager.close).toHaveBeenCalled();
    expect(secondManager.init).toHaveBeenCalled();

    await act(async () => {
      resolveFirstInit({});
      await firstInit;
    });
    expect(view.getByText('user-b')).toBeTruthy();
  });

  it('closes and clears the manager on logout', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };

    const view = renderProvider();
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy());
    const manager = mockCreateUserDatabaseManager.mock.results[0]
      .value as FakeManager;

    mockSessionState = { data: null, isPending: false };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    await waitFor(() => expect(view.getByText('none')).toBeTruthy());
    expect(manager.close).toHaveBeenCalled();
  });

  it('starts sync once the database is open and disposes it before the close on logout', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };

    const view = renderProvider();
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy());
    await waitFor(() => expect(mockCreateSyncController).toHaveBeenCalled());
    expect(madeControllers[0].start).toHaveBeenCalled();

    mockSessionState = { data: null, isPending: false };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    await waitFor(() => expect(view.getByText('none')).toBeTruthy());
    expect(madeControllers[0].dispose).toHaveBeenCalled();
    // the abort (dispose) must land before the database close (#148)
    expect(disposeOrder.indexOf('dispose')).toBeLessThan(
      disposeOrder.indexOf('close'),
    );
  });

  it('never starts sync for a session that ended during init', async () => {
    let resolveInit: (value: unknown) => void = () => {};
    const slowInit = new Promise((resolve) => {
      resolveInit = resolve;
    });
    mockCreateUserDatabaseManager.mockReturnValueOnce(
      makeManager('user-a', slowInit),
    );
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };

    const view = renderProvider();
    mockSessionState = { data: null, isPending: false };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );
    await waitFor(() => expect(view.getByText('none')).toBeTruthy());

    resolveInit({});
    await Promise.resolve();
    expect(mockCreateSyncController).not.toHaveBeenCalled();
  });

  it('keeps the manager across re-renders with the same session', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };

    const view = renderProvider();
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy());
    const manager = mockCreateUserDatabaseManager.mock.results[0]
      .value as FakeManager;

    // A session refetch re-renders with the same user; the database must
    // not close and reopen on every such render.
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    expect(view.getByText('user-a')).toBeTruthy();
    expect(mockCreateUserDatabaseManager).toHaveBeenCalledTimes(1);
    expect(manager.close).not.toHaveBeenCalled();
  });

  it('creates a fresh manager when the same account signs in again', async () => {
    const firstManager = makeManager('first-user-a');
    const reopenedManager = makeManager('reopened-user-a');
    mockCreateUserDatabaseManager
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(reopenedManager);
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };

    const view = renderProvider();
    await waitFor(() => expect(view.getByText('first-user-a')).toBeTruthy());

    mockSessionState = { data: null, isPending: false };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );
    await waitFor(() => expect(view.getByText('none')).toBeTruthy());

    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    await waitFor(() => expect(view.getByText('reopened-user-a')).toBeTruthy());
    expect(firstManager.close).toHaveBeenCalled();
    expect(mockCreateUserDatabaseManager).toHaveBeenNthCalledWith(2, 'user-a');
    expect(reopenedManager.init).toHaveBeenCalled();
  });

  it('starts sync after the banner retry recovers a failed open', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let failOpen = true;
    const manager = makeManager('user-a');
    // The banner calls init() on the manager itself, not through the
    // provider, so recovery has to reach sync some other way.
    manager.init = jest.fn(() => {
      if (failOpen) {
        failOpen = false;
        manager.state = { status: 'error', error: null };
        manager.emit();
        return Promise.reject(new Error('boom'));
      }
      manager.state = { status: 'ready', error: null };
      manager.emit();
      return Promise.resolve({});
    });
    mockCreateUserDatabaseManager.mockReturnValueOnce(manager);
    mockSessionState = { data: { user: { id: 'user-a' } }, isPending: false };

    const view = renderProvider();
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy());
    await waitFor(() => expect(manager.init).toHaveBeenCalledTimes(1));
    expect(mockCreateSyncController).not.toHaveBeenCalled();

    await act(async () => {
      await manager.init().catch(() => {});
    });

    expect(mockCreateSyncController).toHaveBeenCalledTimes(1);
    expect(madeControllers[0].start).toHaveBeenCalled();
  });

  it('waits for the previous close before reopening the same account', async () => {
    let resolveClose!: () => void;
    const closePromise = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    const firstManager = makeManager('first-user-a');
    firstManager.close = jest.fn(() => closePromise);
    const secondManager = makeManager('second-user-a');
    mockCreateUserDatabaseManager
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(secondManager);

    mockSessionState = { data: { user: { id: 'user-a' } }, isPending: false };
    const view = renderProvider();
    await waitFor(() => expect(view.getByText('first-user-a')).toBeTruthy());

    mockSessionState = { data: null, isPending: false };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    mockSessionState = { data: { user: { id: 'user-a' } }, isPending: false };
    await act(async () => {
      view.rerender(
        <SessionDatabaseProvider>
          <ActiveOwner />
        </SessionDatabaseProvider>,
      );
      await Promise.resolve();
    });

    // One SQLite file: the reopen must not start while the close is pending.
    expect(secondManager.init).not.toHaveBeenCalled();

    await act(async () => {
      resolveClose();
      await closePromise;
    });

    await waitFor(() => expect(secondManager.init).toHaveBeenCalled());
  });

  it('reopens the account after a close that throws', async () => {
    const firstManager = makeManager('first-user-a');
    firstManager.close = jest.fn(() => Promise.reject(new Error('close boom')));
    const secondManager = makeManager('second-user-a');
    mockCreateUserDatabaseManager
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(secondManager);

    mockSessionState = { data: { user: { id: 'user-a' } }, isPending: false };
    const view = renderProvider();
    await waitFor(() => expect(view.getByText('first-user-a')).toBeTruthy());

    mockSessionState = { data: null, isPending: false };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    mockSessionState = { data: { user: { id: 'user-a' } }, isPending: false };
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    );

    // A rejected close must not leave every later open queued behind it.
    await waitFor(() => expect(secondManager.init).toHaveBeenCalled());
  });

  it('reattaches sync when the database reopens after an error', async () => {
    const manager = makeManager('user-a');
    mockCreateUserDatabaseManager.mockReturnValueOnce(manager);
    mockSessionState = { data: { user: { id: 'user-a' } }, isPending: false };

    const view = renderProvider();
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy());
    await waitFor(() =>
      expect(mockCreateSyncController).toHaveBeenCalledTimes(1),
    );

    // The database drops out from under the controller, then comes back.
    // The old controller holds the old Database, so it must be replaced.
    await act(async () => {
      manager.state = { status: 'error', error: null };
      manager.emit();
    });
    expect(madeControllers[0].dispose).toHaveBeenCalled();

    await act(async () => {
      manager.state = { status: 'ready', error: null };
      manager.emit();
    });

    expect(mockCreateSyncController).toHaveBeenCalledTimes(2);
    expect(madeControllers[1].start).toHaveBeenCalled();
  });
});
