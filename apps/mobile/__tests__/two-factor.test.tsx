import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TwoFactorChallenge } from '@/components/auth/two-factor-challenge';
import {
  TwoFactorSecurity,
  secretFromTotpUri,
} from '@/components/two-factor-security';
import { finishTwoFactorChallenge } from '@/lib/two-factor-challenge';

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace }),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

const mockVerifyTotp = jest.fn();
const mockVerifyBackupCode = jest.fn();
const mockEnable = jest.fn();
const mockGenerateBackupCodes = jest.fn();
const mockDisable = jest.fn();
const mockSignOut = jest.fn();
const mockListAccounts = jest.fn();
const mockRefetch = jest.fn();
type MockSession = {
  data: {
    user: {
      id: string;
      email: string;
      twoFactorEnabled: boolean;
      onBoardingComplete: boolean;
    };
  } | null;
  refetch: typeof mockRefetch;
};
const signedInSession: MockSession = {
  data: {
    user: {
      id: 'user-1',
      email: 'learner@example.com',
      twoFactorEnabled: false,
      onBoardingComplete: true,
    },
  },
  refetch: mockRefetch,
};
let mockSession: MockSession = signedInSession;

jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => mockSession,
    signOut: (...args: unknown[]) => mockSignOut(...args),
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    twoFactor: {
      verifyTotp: (...args: unknown[]) => mockVerifyTotp(...args),
      verifyBackupCode: (...args: unknown[]) => mockVerifyBackupCode(...args),
      enable: (...args: unknown[]) => mockEnable(...args),
      generateBackupCodes: (...args: unknown[]) =>
        mockGenerateBackupCodes(...args),
      disable: (...args: unknown[]) => mockDisable(...args),
    },
  },
}));

const mockSetStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));
const mockPreventScreenCapture = jest.fn();
jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: (...args: unknown[]) =>
    mockPreventScreenCapture(...args),
}));
jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: () => {
    const { View } = require('react-native');
    return <View testID="setup-qr" />;
  },
}));

describe('two-factor sign-in challenge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    finishTwoFactorChallenge();
    mockSession = signedInSession;
    mockVerifyTotp.mockResolvedValue({
      data: { token: 'session-token', user: { id: 'user-1' } },
      error: null,
    });
    mockVerifyBackupCode.mockResolvedValue({
      data: { token: 'session-token', user: { id: 'user-1' } },
      error: null,
    });
    mockSignOut.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('verifies a valid authenticator code before opening the dashboard', async () => {
    mockSession = { data: null, refetch: mockRefetch };
    const view = render(<TwoFactorChallenge />);
    fireEvent.changeText(view.getByLabelText('Authentication code'), '123456');
    fireEvent.press(view.getByText('Verify and continue'));

    await waitFor(() =>
      expect(mockVerifyTotp).toHaveBeenCalledWith({
        code: '123456',
        trustDevice: false,
      }),
    );
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');

    mockSession = signedInSession;
    view.rerender(<TwoFactorChallenge />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });

  it('keeps an invalid code signed out and explains the error', async () => {
    mockSession = { data: null, refetch: mockRefetch };
    mockVerifyTotp.mockResolvedValueOnce({
      data: null,
      error: { code: 'INVALID_CODE' },
    });
    const view = render(<TwoFactorChallenge />);
    fireEvent.changeText(view.getByLabelText('Authentication code'), '654321');
    fireEvent.press(view.getByText('Verify and continue'));

    expect(await view.findByText(/invalid or has expired/i)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');
  });

  it('recovers with a backup code', async () => {
    mockSession = signedInSession;
    const view = render(<TwoFactorChallenge />);
    fireEvent.press(view.getByText('Backup code'));
    fireEvent.changeText(view.getByLabelText('Backup code'), 'recovery-one');
    fireEvent.press(view.getByText('Verify and continue'));

    await waitFor(() =>
      expect(mockVerifyBackupCode).toHaveBeenCalledWith({
        code: 'recovery-one',
        disableSession: false,
        trustDevice: false,
      }),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });

  it('clears the temporary sign-in when returning to login', async () => {
    const view = render(<TwoFactorChallenge />);
    fireEvent.press(view.getByText('Back to sign in'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});

describe('two-factor security settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = {
      data: {
        user: {
          id: 'user-1',
          email: 'learner@example.com',
          twoFactorEnabled: false,
          onBoardingComplete: true,
        },
      },
      refetch: mockRefetch,
    };
    mockListAccounts.mockResolvedValue({
      data: [{ id: 'account-1', providerId: 'credential' }],
      error: null,
    });
    mockRefetch.mockResolvedValue(undefined);
  });

  it('enrolls, exposes a copyable manual key, and shows backup codes after verification', async () => {
    mockEnable.mockResolvedValue({
      data: {
        totpURI:
          'otpauth://totp/NotAnotherCards:learner?secret=MANUALKEY&issuer=NotAnotherCards',
        backupCodes: ['recovery-one', 'recovery-two'],
      },
      error: null,
    });
    mockVerifyTotp.mockResolvedValue({
      data: { token: 'session-token', user: { id: 'user-1' } },
      error: null,
    });
    mockSetStringAsync.mockResolvedValue(undefined);

    const view = render(<TwoFactorSecurity />);
    await waitFor(() =>
      expect(
        view.getByRole('button', {
          name: 'Enable two-factor authentication',
        }).props.accessibilityState.disabled,
      ).toBe(false),
    );
    fireEvent.press(view.getByText('Enable two-factor authentication'));
    fireEvent.changeText(view.getByLabelText('Current password'), 'Password1!');
    fireEvent.press(view.getByText('Continue'));

    expect(await view.findByDisplayValue('MANUALKEY')).toBeTruthy();
    expect(view.queryByText('recovery-one')).toBeNull();
    fireEvent.press(view.getByText('Copy manual setup key'));
    await waitFor(() =>
      expect(mockSetStringAsync).toHaveBeenCalledWith('MANUALKEY'),
    );
    fireEvent.changeText(view.getByLabelText('Authentication code'), '123456');
    fireEvent.press(view.getByText('Verify and enable'));

    expect(await view.findByText('recovery-one')).toBeTruthy();
    expect(mockPreventScreenCapture).toHaveBeenCalled();
  });

  it('regenerates backup codes and disables two-factor with a password', async () => {
    mockSession.data!.user.twoFactorEnabled = true;
    mockGenerateBackupCodes.mockResolvedValue({
      data: { status: true, backupCodes: ['new-recovery'] },
      error: null,
    });
    mockDisable.mockResolvedValue({ data: { status: true }, error: null });

    const view = render(<TwoFactorSecurity />);
    fireEvent.press(view.getByText('Regenerate backup codes'));
    fireEvent.changeText(view.getByLabelText('Current password'), 'Password1!');
    fireEvent.press(view.getByText('Generate new codes'));
    expect(await view.findByText('new-recovery')).toBeTruthy();
    fireEvent.press(view.getByText('I saved my codes'));

    fireEvent.press(view.getByText('Disable two-factor'));
    fireEvent.changeText(view.getByLabelText('Current password'), 'Password1!');
    fireEvent.press(view.getByText('Disable two-factor'));

    await waitFor(() =>
      expect(mockDisable).toHaveBeenCalledWith({ password: 'Password1!' }),
    );
    expect(view.getByText('Two-factor is off')).toBeTruthy();
  });
});

it('extracts the manual secret without persisting enrollment material', () => {
  expect(
    secretFromTotpUri('otpauth://totp/account?secret=ABC123&issuer=NAC'),
  ).toBe('ABC123');
  expect(secretFromTotpUri('not a uri')).toBe('');
});
