import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';
import '@/lib/i18n';
import { RequireSession } from '@/components/require-session';
import { Settings } from '@/components/settings';

const mockRefetch = jest.fn();
let mockSession: {
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      onBoardingComplete: boolean;
      twoFactorEnabled: boolean;
    };
  };
  isPending: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: typeof mockRefetch;
};
jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => mockSession,
    listAccounts: async () => ({
      data: [{ providerId: 'credential' }],
      error: null,
    }),
    twoFactor: {
      enable: async () => ({
        data: {
          totpURI: 'otpauth://totp/Test?secret=TESTONLY',
          backupCodes: ['test-recovery-one', 'test-recovery-two'],
        },
        error: null,
      }),
      verifyTotp: async () => ({ data: { status: true }, error: null }),
    },
  },
}));
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ manager: null, syncController: null }),
}));
jest.mock('../lib/two-factor-challenge', () => ({
  useTwoFactorChallengeState: () => ({ hydrated: true, pending: false }),
  useTwoFactorDeepLinkPending: () => false,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Redirect: () => null,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: jest.fn(),
}));
jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: () => null,
}));

const tree = () => (
  <RequireSession>
    <Settings />
  </RequireSession>
);
beforeEach(() => {
  mockRefetch.mockClear();
  mockSession = {
    data: {
      user: {
        id: 'u1',
        name: 'Learner',
        email: 'test@example.com',
        onBoardingComplete: true,
        twoFactorEnabled: false,
      },
    },
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  };
});
async function enroll() {
  const view = await renderWithLocale(tree(), 'en');
  fireEvent.press(view.getByRole('tab', { name: 'Security' }));
  // Wait for the real component's account lookup to enable the button.
  await waitFor(() =>
    expect(
      view.getByRole('button', { name: 'Enable two-factor authentication' }),
    ).not.toBeDisabled(),
  );
  fireEvent.press(view.getByText('Enable two-factor authentication'));
  fireEvent.changeText(
    view.getByLabelText('Current password'),
    'test-only-password',
  );
  fireEvent.press(view.getByText('Continue'));
  fireEvent.changeText(
    await view.findByLabelText('Authentication code'),
    '123456',
  );
  fireEvent.press(view.getByText('Verify and enable'));
  await view.findByText('test-recovery-one');
  return view;
}
it('updates the visible backup-code title when the language changes', async () => {
  const view = await enroll();
  expect(view.getByText('Save your backup codes')).toBeTruthy();
  await act(async () => {
    await view.i18n.changeLanguage('de');
  });
  expect(view.getByText('Speichere deine Backup-Codes')).toBeTruthy();
  expect(view.queryByText('Save your backup codes')).toBeNull();
  expect(view.getByText('test-recovery-one')).toBeTruthy();
});

it('keeps codes through a normal refetch and a changed same-account user object', async () => {
  const view = await enroll();
  mockSession = { ...mockSession, isRefetching: true };
  view.rerender(tree());
  expect(view.getByText('test-recovery-one')).toBeTruthy();
  mockSession = {
    ...mockSession,
    isRefetching: false,
    data: { user: { ...mockSession.data.user, twoFactorEnabled: true } },
  };
  view.rerender(tree());
  expect(view.getByText('test-recovery-one')).toBeTruthy();
  expect(mockRefetch).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('I saved my codes'));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
it('keeps unacknowledged backup codes through a failed background session refresh', async () => {
  // The Expo auth client refetches the session whenever the stored cookie
  // changes, and verifying the TOTP rotates it. Better Auth keeps the
  // session data on a network error, and so must the screen: the codes are
  // shown once.
  const view = await enroll();
  mockSession = { ...mockSession, error: new Error('Network request failed') };
  view.rerender(tree());
  expect(view.getByText('test-recovery-one')).toBeTruthy();
  expect(view.getByText(/Can't reach the server/)).toBeTruthy();
  mockSession = {
    ...mockSession,
    error: null,
    data: { user: { ...mockSession.data.user, twoFactorEnabled: true } },
  };
  view.rerender(tree());
  expect(view.getByText('test-recovery-one')).toBeTruthy();
  expect(view.queryByText(/Can't reach the server/)).toBeNull();
});
