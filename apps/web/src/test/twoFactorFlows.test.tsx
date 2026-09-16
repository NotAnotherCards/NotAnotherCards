import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/lib/auth-client';
import { TwoFactorChallenge } from '@/components/auth/two-factor-challenge';
import { LoginComponent } from '@/components/auth/login-form';
import { TwoFactorSecurity } from '@/components/dashboard/settings/TwoFactorSecurity';

const navigate = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigate,
    useSearch: () => ({ redirect: '/deck-review?deckId=deck-1' }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

const session = (twoFactorEnabled: boolean) => ({
  session: {
    id: 'session-1',
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 60_000),
    token: 'token-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-1',
    email: 'learner@example.com',
    name: 'Learner',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    twoFactorEnabled,
  },
});

function mockSession(twoFactorEnabled: boolean) {
  vi.mocked(authClient.useSession).mockReturnValue({
    data: session(twoFactorEnabled),
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof authClient.useSession>);
}

describe('two-factor security settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession(false);
    vi.mocked(authClient.listAccounts).mockResolvedValue({
      data: [{ id: 'account-1', providerId: 'credential' }],
      error: null,
    } as Awaited<ReturnType<typeof authClient.listAccounts>>);
  });

  it('enrolls, verifies setup, and reveals backup codes only after verification', async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.twoFactor.enable).mockResolvedValue({
      data: {
        totpURI:
          'otpauth://totp/NotAnotherCards:learner?secret=TESTSETUPKEY&issuer=NotAnotherCards',
        backupCodes: ['recovery-one', 'recovery-two'],
      },
      error: null,
    } as Awaited<ReturnType<typeof authClient.twoFactor.enable>>);
    vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue({
      data: { status: true },
      error: null,
    } as Awaited<ReturnType<typeof authClient.twoFactor.verifyTotp>>);

    render(<TwoFactorSecurity />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Enable two-factor authentication',
      }),
    );
    await user.type(screen.getByLabelText('Current password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByDisplayValue('TESTSETUPKEY')).toBeInTheDocument();
    expect(screen.queryByText('recovery-one')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '123456' },
    });
    await user.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(await screen.findByText('recovery-one')).toBeInTheDocument();
    expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
      code: '123456',
    });

    await user.click(screen.getByRole('button', { name: 'I saved my codes' }));
    expect(screen.getByText('Two-factor is enabled')).toBeInTheDocument();
    expect(screen.queryByText('recovery-one')).not.toBeInTheDocument();
  });

  it('disables enrollment for a social-only account and explains how to add a credential', async () => {
    vi.mocked(authClient.listAccounts).mockResolvedValue({
      data: [{ id: 'account-1', providerId: 'google' }],
      error: null,
    } as Awaited<ReturnType<typeof authClient.listAccounts>>);

    render(<TwoFactorSecurity />);

    expect(
      await screen.findByText('A password is required'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Enable two-factor authentication' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('link', { name: 'password reset flow' }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('does not restore enrollment material after leaving the setup screen', async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.twoFactor.enable).mockResolvedValue({
      data: {
        totpURI:
          'otpauth://totp/NotAnotherCards:learner?secret=EPHEMERALKEY&issuer=NotAnotherCards',
        backupCodes: ['ephemeral-recovery'],
      },
      error: null,
    } as Awaited<ReturnType<typeof authClient.twoFactor.enable>>);

    const view = render(<TwoFactorSecurity />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Enable two-factor authentication',
      }),
    );
    await user.type(screen.getByLabelText('Current password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByDisplayValue('EPHEMERALKEY')).toBeInTheDocument();

    view.unmount();
    render(<TwoFactorSecurity />);

    expect(screen.queryByDisplayValue('EPHEMERALKEY')).not.toBeInTheDocument();
    expect(screen.queryByText('ephemeral-recovery')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {
        name: 'Enable two-factor authentication',
      }),
    ).toBeInTheDocument();
  });

  it('regenerates backup codes and warns that existing codes stop working', async () => {
    const user = userEvent.setup();
    mockSession(true);
    vi.mocked(authClient.twoFactor.generateBackupCodes).mockResolvedValue({
      data: { status: true, backupCodes: ['new-recovery-code'] },
      error: null,
    } as Awaited<ReturnType<typeof authClient.twoFactor.generateBackupCodes>>);

    render(<TwoFactorSecurity />);
    await user.click(
      await screen.findByRole('button', { name: 'Regenerate backup codes' }),
    );
    expect(
      screen.getByText('Your existing backup codes will stop working.'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Current password'), 'Password123!');
    await user.click(
      screen.getByRole('button', { name: 'Generate new codes' }),
    );

    expect(await screen.findByText('new-recovery-code')).toBeInTheDocument();
    expect(authClient.twoFactor.generateBackupCodes).toHaveBeenCalledWith({
      password: 'Password123!',
    });
  });

  it('requires the current password to disable two-factor authentication', async () => {
    const user = userEvent.setup();
    mockSession(true);
    vi.mocked(authClient.twoFactor.disable).mockResolvedValue({
      data: { status: true },
      error: null,
    } as Awaited<ReturnType<typeof authClient.twoFactor.disable>>);

    render(<TwoFactorSecurity />);
    await user.click(
      await screen.findByRole('button', { name: 'Disable two-factor' }),
    );
    await user.type(screen.getByLabelText('Current password'), 'Password123!');
    await user.click(
      screen.getByRole('button', { name: 'Disable two-factor' }),
    );

    await waitFor(() =>
      expect(authClient.twoFactor.disable).toHaveBeenCalledWith({
        password: 'Password123!',
      }),
    );
    expect(screen.getByText('Two-factor is off')).toBeInTheDocument();
  });
});

describe('two-factor sign-in challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockResolvedValue(undefined);
    window.sessionStorage.clear();
  });

  it('moves an email/password sign-in into the challenge without creating a protected session', async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
      error: null,
    } as Awaited<ReturnType<typeof authClient.signIn.email>>);

    render(<LoginComponent />);
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(navigate).toHaveBeenCalledWith({
      to: '/two-factor',
      search: { redirect: '/deck-review?deckId=deck-1' },
    });
    expect(
      window.sessionStorage.getItem('notanothercards.pending-two-factor'),
    ).toContain('/deck-review?deckId=deck-1');
  });

  it('accepts a pasted authenticator code and returns to the intended route', async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue({
      data: { status: true },
      error: null,
    } as Awaited<ReturnType<typeof authClient.twoFactor.verifyTotp>>);
    render(<TwoFactorChallenge redirect="/deck-review?deckId=deck-1" />);

    fireEvent.paste(screen.getByLabelText('Digit 1 of 6'), {
      clipboardData: { getData: () => '123 456' },
    });
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveFocus();
    await user.click(
      screen.getByRole('button', { name: 'Verify and continue' }),
    );

    expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
      code: '123456',
      trustDevice: false,
    });
    expect(navigate).toHaveBeenCalledWith({
      href: '/deck-review?deckId=deck-1',
      replace: true,
    });
  });

  it('switches to recovery and verifies a backup code', async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.twoFactor.verifyBackupCode).mockResolvedValue({
      data: { token: 'session-token', user: session(false).user },
      error: null,
    } as Awaited<ReturnType<typeof authClient.twoFactor.verifyBackupCode>>);
    render(<TwoFactorChallenge redirect="/dashboard" />);

    await user.click(screen.getByRole('button', { name: 'Backup code' }));
    await user.type(screen.getByLabelText('Backup code'), 'recovery-one');
    await user.click(
      screen.getByRole('button', { name: 'Verify and continue' }),
    );

    expect(authClient.twoFactor.verifyBackupCode).toHaveBeenCalledWith({
      code: 'recovery-one',
      disableSession: false,
      trustDevice: false,
    });
  });

  it.each([
    ['INVALID_CODE', 'invalid or has expired'],
    ['ACCOUNT_TEMPORARILY_LOCKED', 'temporarily locked'],
  ])('shows an accessible error for %s', async (code, message) => {
    const user = userEvent.setup();
    vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue({
      data: null,
      error: {
        code,
        message: 'server detail',
        status: 400,
        statusText: 'Bad Request',
      },
    } as Awaited<ReturnType<typeof authClient.twoFactor.verifyTotp>>);
    render(<TwoFactorChallenge redirect="/dashboard" />);

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '123456' },
    });
    await user.click(
      screen.getByRole('button', { name: 'Verify and continue' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(navigate).not.toHaveBeenCalled();
  });
});
