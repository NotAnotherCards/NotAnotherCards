import React, { type ReactNode } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SessionDatabaseProvider } from '@/lib/database-provider';
import { TwoFactorChallenge } from '@/components/auth/two-factor-challenge';
import { TwoFactorLifecycle } from '@/components/two-factor-lifecycle';
import { RequireSession } from '@/components/require-session';
import {
  beginTwoFactorChallenge,
  finishTwoFactorChallenge,
  getTwoFactorChallengeState,
} from '@/lib/two-factor-challenge';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Link: ({ children }: { children: ReactNode }) => children,
  Redirect: ({ href }: { href: string }) => {
    const React = require('react');
    React.useEffect(() => mockReplace(href), [href]);
    return null;
  },
}));

type User = { id: string; onBoardingComplete: boolean };
const mockRefetch = jest.fn(async () => {});
let mockSession: {
  data: { user: User } | null;
  isPending: boolean;
  isRefetching: boolean;
  refetch: typeof mockRefetch;
};
const mockVerify = jest.fn();
jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => mockSession,
    twoFactor: {
      verifyTotp: (...args: unknown[]) => mockVerify(...args),
      verifyBackupCode: (...args: unknown[]) => mockVerify(...args),
    },
  },
}));
jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: jest.fn(),
}));

const mockStorage = new Map<string, string>();
let mockDeleteBarrier: Promise<void> | null = null;
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    await mockDeleteBarrier;
    mockStorage.delete(key);
  }),
}));

// Keep the real provider and remelonDB ownership hook: inserting its database
// context remounts the navigator, which isolated screen tests cannot exercise.
const mockClose = jest.fn(async () => {});
const mockCreateManager = jest.fn((_userId: string) => ({
  state: { status: 'initializing' },
  subscribe: () => () => {},
  init: async () => {},
  close: mockClose,
}));
jest.mock('../lib/db', () => ({
  createUserDatabaseManager: (userId: string) => mockCreateManager(userId),
}));
jest.mock('../lib/sync', () => ({
  pullChanges: jest.fn(),
  pushChanges: jest.fn(),
}));
jest.mock('../lib/sync-triggers', () => ({ nativeSyncTriggers: [] }));

function TestApp() {
  const [route, setRoute] = React.useState('/two-factor');
  mockReplace.mockImplementation(setRoute);
  return (
    <SessionDatabaseProvider>
      <TwoFactorLifecycle deepLinkPending={false} />
      {route === '/two-factor' ? (
        <TwoFactorChallenge />
      ) : (
        <RequireSession>
          <Text>Dashboard</Text>
        </RequireSession>
      )}
    </SessionDatabaseProvider>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockDeleteBarrier = null;
  mockStorage.clear();
  await finishTwoFactorChallenge();
  await beginTwoFactorChallenge();
  mockSession = {
    data: null,
    isPending: false,
    isRefetching: false,
    refetch: mockRefetch,
  };
});

it.each(['totp', 'backup'])(
  'finishes %s sign-in through a database remount while native deletion is pending',
  async (mode) => {
    let acceptCode!: (result: { data: { user: User }; error: null }) => void;
    mockVerify.mockReturnValue(
      new Promise((resolve) => {
        acceptCode = resolve;
      }),
    );
    const view = render(<TestApp />);
    if (mode === 'backup') fireEvent.press(view.getByText('Backup code'));
    fireEvent.changeText(
      view.getByLabelText(
        mode === 'totp' ? 'Authentication code' : 'Backup code',
      ),
      mode === 'totp' ? '123456' : 'saved-backup-code',
    );
    fireEvent.press(view.getByText('Verify and continue'));
    expect(mockCreateManager).not.toHaveBeenCalled();

    let finishDeletion!: () => void;
    mockDeleteBarrier = new Promise((resolve) => {
      finishDeletion = resolve;
    });
    try {
      await act(async () => {
        const user = { id: 'user-1', onBoardingComplete: true };
        mockSession = { ...mockSession, data: { user } };
        acceptCode({ data: { user }, error: null });
      });
      await waitFor(() =>
        expect(mockCreateManager).toHaveBeenCalledWith('user-1'),
      );
      expect(getTwoFactorChallengeState().pending).toBe(false);
      expect(await view.findByText('Dashboard')).toBeTruthy();
      expect(mockVerify).toHaveBeenCalledTimes(1);
      expect(mockClose).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        finishDeletion();
      });
    }
    expect(mockStorage.has('notanothercards.pending-two-factor')).toBe(false);
    expect(getTwoFactorChallengeState().pending).toBe(false);
  },
);
