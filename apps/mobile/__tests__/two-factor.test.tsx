import React from 'react';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import '@/lib/i18n';
import { TwoFactorChallenge } from '@/components/auth/two-factor-challenge';
import { TwoFactorLifecycle } from '@/components/two-factor-lifecycle';
import {
  TwoFactorSecurity,
  secretFromTotpUri,
} from '@/components/two-factor-security';
import {
  beginTwoFactorChallenge,
  finishTwoFactorChallenge,
  getTwoFactorChallengeState,
} from '@/lib/two-factor-challenge';

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
const mockClearLocalAuthStorage = jest.fn();
const mockListAccounts = jest.fn();
const mockRefetch = jest.fn();
const mockRequestPasswordReset = jest.fn();
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
  isPending?: boolean;
  isRefetching?: boolean;
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
let mockSession: MockSession = { data: null, refetch: mockRefetch };

jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => mockSession,
    signOut: (...args: unknown[]) => mockSignOut(...args),
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    requestPasswordReset: (...args: unknown[]) =>
      mockRequestPasswordReset(...args),
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
jest.mock('../lib/auth-storage', () => ({
  clearLocalAuthStorage: (...args: unknown[]) =>
    mockClearLocalAuthStorage(...args),
}));

const mockSetStringAsync = jest.fn();
const mockGetStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
  getStringAsync: () => mockGetStringAsync(),
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
  beforeEach(async () => {
    jest.clearAllMocks();
    await finishTwoFactorChallenge();
    await beginTwoFactorChallenge();
    mockSession = { data: null, refetch: mockRefetch };
    mockVerifyTotp.mockResolvedValue({
      data: { token: 'session-token', user: { id: 'user-1' } },
      error: null,
    });
    mockVerifyBackupCode.mockResolvedValue({
      data: { token: 'session-token', user: { id: 'user-1' } },
      error: null,
    });
    mockSignOut.mockResolvedValue({ data: { success: true }, error: null });
    mockClearLocalAuthStorage.mockResolvedValue(undefined);
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

  it('finishes login when the auth session update remounts the challenge', async () => {
    let resolveVerification: (value: {
      data: { token: string; user: { id: string } };
      error: null;
    }) => void = () => {};
    const verification = new Promise<{
      data: { token: string; user: { id: string } };
      error: null;
    }>((resolve) => {
      resolveVerification = resolve;
    });
    mockVerifyTotp.mockReturnValueOnce(verification);
    mockSession = { data: null, refetch: mockRefetch };
    const firstView = render(<TwoFactorChallenge />);
    fireEvent.changeText(
      firstView.getByLabelText('Authentication code'),
      '123456',
    );
    fireEvent.press(firstView.getByText('Verify and continue'));

    await waitFor(() => expect(mockVerifyTotp).toHaveBeenCalled());
    firstView.unmount();

    mockSession = signedInSession;
    render(<TwoFactorChallenge />);
    await act(async () => {
      resolveVerification({
        data: { token: 'session-token', user: { id: 'user-1' } },
        error: null,
      });
      await verification;
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(getTwoFactorChallengeState().pending).toBe(false);
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

  it('does not create a challenge when its route is opened while signed out', async () => {
    await finishTwoFactorChallenge();
    const view = render(<TwoFactorChallenge />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(view.queryByLabelText('Authentication code')).toBeNull();
    expect(getTwoFactorChallengeState().pending).toBe(false);
  });

  it('does not restart verification when the completed screen remounts', async () => {
    await finishTwoFactorChallenge();
    mockSession = signedInSession;
    render(<TwoFactorChallenge />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(getTwoFactorChallengeState().pending).toBe(false);
    expect(mockVerifyTotp).not.toHaveBeenCalled();
  });

  it('recovers with a backup code', async () => {
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
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');

    mockSession = signedInSession;
    view.rerender(<TwoFactorChallenge />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });

  it('rejects a used backup code and keeps the challenge pending', async () => {
    mockVerifyBackupCode.mockResolvedValueOnce({
      data: null,
      error: { code: 'INVALID_BACKUP_CODE', message: 'Invalid backup code' },
    });
    const view = render(<TwoFactorChallenge />);
    fireEvent.press(view.getByText('Backup code'));
    fireEvent.changeText(view.getByLabelText('Backup code'), 'recovery-one');
    fireEvent.press(view.getByText('Verify and continue'));

    expect(
      await view.findByText(
        'That backup code is invalid or has already been used.',
      ),
    ).toBeTruthy();
    expect(getTwoFactorChallengeState().pending).toBe(true);
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');
  });

  it('lets the user retry when the verified session cannot be refreshed', async () => {
    const view = render(<TwoFactorChallenge />);
    fireEvent.changeText(view.getByLabelText('Authentication code'), '123456');
    fireEvent.press(view.getByText('Verify and continue'));

    expect(
      await view.findByText(/signed-in session could not be confirmed/i),
    ).toBeTruthy();
    expect(view.getByText('Retry session')).toBeTruthy();
    expect(view.getByText('Back to sign in')).toBeTruthy();

    mockSession = signedInSession;
    fireEvent.press(view.getByText('Retry session'));
    view.rerender(<TwoFactorChallenge />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });

  it('clears the temporary sign-in when returning to login', async () => {
    mockSession = { data: null, refetch: mockRefetch };
    const view = render(<TwoFactorChallenge />);
    fireEvent.press(view.getByText('Back to sign in'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('clears terminal challenge failures and returns to login', async () => {
    mockVerifyTotp.mockResolvedValueOnce({
      data: null,
      error: { code: 'INVALID_TWO_FACTOR_COOKIE' },
    });
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const view = render(<TwoFactorChallenge />);
    fireEvent.changeText(view.getByLabelText('Authentication code'), '123456');
    fireEvent.press(view.getByText('Verify and continue'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(getTwoFactorChallengeState().pending).toBe(false);
    alertSpy.mockRestore();
  });

  it('signs out when the verification attempt budget is exhausted', async () => {
    mockVerifyTotp.mockResolvedValueOnce({
      data: null,
      error: { code: 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE' },
    });
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const view = render(<TwoFactorChallenge />);
    fireEvent.changeText(view.getByLabelText('Authentication code'), '123456');
    fireEvent.press(view.getByText('Verify and continue'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(getTwoFactorChallengeState().pending).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign-in could not continue',
      expect.stringMatching(/start a new verification request/i),
    );
    alertSpy.mockRestore();
  });

  it('clears local auth when server sign-out fails', async () => {
    mockSignOut.mockResolvedValueOnce({
      data: null,
      error: { message: 'Server unavailable' },
    });
    const view = render(<TwoFactorChallenge />);
    fireEvent.press(view.getByText('Back to sign in'));

    await waitFor(() => expect(mockClearLocalAuthStorage).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(getTwoFactorChallengeState().pending).toBe(false);
  });

  it('keeps the challenge gate when local sign-out cannot be guaranteed', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Network unavailable'));
    mockClearLocalAuthStorage.mockRejectedValueOnce(
      new Error('SecureStore unavailable'),
    );
    const view = render(<TwoFactorChallenge />);
    fireEvent.press(view.getByText('Back to sign in'));

    expect(await view.findByText(/Could not safely sign out/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalledWith('/login');
    expect(getTwoFactorChallengeState().pending).toBe(true);
  });

  it('hydrates a deep-linked challenge and routes directly to verification', async () => {
    render(<TwoFactorLifecycle deepLinkPending />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/two-factor'),
    );
    expect(getTwoFactorChallengeState()).toEqual({
      pending: true,
      hydrated: true,
      verifiedUserId: null,
    });
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
    mockSignOut.mockResolvedValue({ data: { success: true }, error: null });
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
    mockGetStringAsync.mockResolvedValue('MANUALKEY');

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
    expect(mockEnable).toHaveBeenCalledWith(
      {
        password: 'Password1!',
        issuer: 'NotAnotherCards',
      },
      { disableSignal: true },
    );
    expect(view.queryByText('recovery-one')).toBeNull();
    fireEvent.press(view.getByText('Copy manual setup key'));
    await waitFor(() =>
      expect(mockSetStringAsync).toHaveBeenCalledWith('MANUALKEY'),
    );
    fireEvent.changeText(view.getByLabelText('Authentication code'), '123456');
    fireEvent.press(view.getByText('Verify and enable'));

    expect(await view.findByText('recovery-one')).toBeTruthy();
    expect(mockVerifyTotp).toHaveBeenCalledWith(
      { code: '123456' },
      { disableSignal: true },
    );
    expect(mockRefetch).not.toHaveBeenCalled();
    expect(mockPreventScreenCapture).toHaveBeenCalled();

    fireEvent.press(view.getByText('I saved my codes'));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
    expect(view.queryByText('recovery-one')).toBeNull();
    // the copied setup key does not outlive the setup
    await waitFor(() =>
      expect(mockSetStringAsync).toHaveBeenLastCalledWith(''),
    );
  });

  it.each([false, true])(
    'retranslates clipboard status after a language switch (failed: %s)',
    async (failed) => {
      mockEnable.mockResolvedValue({
        data: {
          totpURI: 'otpauth://totp/Test?secret=MANUALKEY',
          backupCodes: [],
        },
        error: null,
      });
      if (failed)
        mockSetStringAsync.mockRejectedValueOnce(
          new Error('clipboard unavailable'),
        );
      else mockSetStringAsync.mockResolvedValueOnce(undefined);
      const screen = await renderWithLocale(<TwoFactorSecurity />, 'es');
      const button = await screen.findByRole('button', {
        name: screen.i18n.t('dashboard.settings.two_factor.enable_two_factor'),
      });
      await waitFor(() => expect(button).not.toBeDisabled());
      fireEvent.press(button);
      fireEvent.changeText(
        screen.getByLabelText(
          screen.i18n.t('dashboard.settings.two_factor.current_password'),
        ),
        'Password1!',
      );
      fireEvent.press(
        screen.getByText(
          screen.i18n.t('dashboard.settings.two_factor.continue'),
        ),
      );
      await screen.findByDisplayValue('MANUALKEY');
      fireEvent.press(
        screen.getByText(
          screen.i18n.t('dashboard.settings.two_factor.copy_manual_key'),
        ),
      );
      const key = failed
        ? 'dashboard.settings.two_factor.manual_key_copy_fail'
        : 'dashboard.settings.two_factor.manual_key_copied';
      const spanish = screen.i18n.t(key);
      expect(await screen.findByText(spanish)).toBeTruthy();
      await act(async () => {
        await screen.i18n.changeLanguage('de');
      });
      expect(screen.getByText(screen.i18n.t(key))).toBeTruthy();
      expect(screen.queryByText(spanish)).toBeNull();
      expect(mockSetStringAsync).toHaveBeenCalledTimes(1);
    },
  );

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
    expect(mockGenerateBackupCodes).toHaveBeenCalledWith(
      { password: 'Password1!' },
      { disableSignal: true },
    );
    fireEvent.press(view.getByText('I saved my codes'));

    fireEvent.press(view.getByText('Disable two-factor'));
    fireEvent.changeText(view.getByLabelText('Current password'), 'Password1!');
    fireEvent.press(view.getByText('Disable two-factor'));

    await waitFor(() =>
      expect(mockDisable).toHaveBeenCalledWith(
        { password: 'Password1!' },
        { disableSignal: true },
      ),
    );
    expect(view.getByText('Two-factor is off')).toBeTruthy();
  });

  it('takes a social-only account through sign-out to password creation', async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [{ id: 'account-1', providerId: 'google' }],
      error: null,
    });
    const view = render(<TwoFactorSecurity />);

    expect(await view.findByText('A password is required')).toBeTruthy();
    fireEvent.press(view.getByText('Sign out and create a password'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/forgot-password',
      params: { email: 'learner@example.com' },
    });
  });

  it('explains an account lookup failure and lets the user retry', async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: null,
      error: { message: 'Server unavailable' },
    });
    const view = render(<TwoFactorSecurity />);

    expect(
      await view.findByText(/Could not check your sign-in methods/),
    ).toBeTruthy();
    fireEvent.press(view.getByText('Retry sign-in methods'));

    await waitFor(() => expect(mockListAccounts).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        view.getByRole('button', {
          name: 'Enable two-factor authentication',
        }).props.accessibilityState.disabled,
      ).toBe(false),
    );
  });
});

describe('mobile password creation entry point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPasswordReset.mockResolvedValue({
      data: { status: true },
      error: null,
    });
  });

  it('requests a reset link for the prefilled social-account email', async () => {
    const onSent = jest.fn();
    const view = render(
      <ForgotPasswordForm defaultEmail="learner@example.com" onSent={onSent} />,
    );
    fireEvent.press(view.getByText('Send Reset Link'));

    await waitFor(() =>
      expect(mockRequestPasswordReset).toHaveBeenCalledWith({
        email: 'learner@example.com',
      }),
    );
    expect(onSent).toHaveBeenCalledWith('learner@example.com');
  });
});

it('extracts the manual secret without persisting enrollment material', () => {
  expect(
    secretFromTotpUri('otpauth://totp/account?secret=ABC123&issuer=NAC'),
  ).toBe('ABC123');
  expect(secretFromTotpUri('not a uri')).toBe('');
});
