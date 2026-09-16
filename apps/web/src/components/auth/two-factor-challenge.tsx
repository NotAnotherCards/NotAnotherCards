import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import {
  emptyTotpDigits,
  TotpCodeInput,
} from '@/components/auth/totp-code-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import {
  clearPendingChallenge,
  pendingChallengeReturnTo,
  safeReturnTo,
} from '@/lib/two-factor-challenge';

type ChallengeMode = 'totp' | 'backup';

function challengeError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  if (code === 'ACCOUNT_TEMPORARILY_LOCKED') {
    return 'Too many failed attempts. Your account is temporarily locked. Please try again later.';
  }
  if (code === 'INVALID_BACKUP_CODE') {
    return 'That backup code is invalid or has already been used.';
  }
  if (code === 'INVALID_CODE') {
    return 'That authentication code is invalid or has expired.';
  }
  if (code === 'INVALID_TWO_FACTOR_COOKIE') {
    return 'This verification request has expired. Sign in again to continue.';
  }
  return 'Verification failed. Check the code and try again.';
}

export function TwoFactorChallenge({ redirect }: { redirect?: string }) {
  const navigate = useNavigate();
  const returnTo = useMemo(
    () => safeReturnTo(redirect ?? pendingChallengeReturnTo()),
    [redirect],
  );
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [totpDigits, setTotpDigits] = useState(emptyTotpDigits);
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const changeMode = (nextMode: ChallengeMode) => {
    setMode(nextMode);
    setTotpDigits(emptyTotpDigits());
    setBackupCode('');
    setError(null);
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedCode =
      mode === 'totp' ? totpDigits.join('') : backupCode.trim();
    if (mode === 'totp' && normalizedCode.length !== 6) {
      setError('Enter the six-digit code from your authenticator app.');
      return;
    }
    if (mode === 'backup' && !normalizedCode) {
      setError('Enter one of your backup codes.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response =
        mode === 'totp'
          ? await authClient.twoFactor.verifyTotp({
              code: normalizedCode,
              trustDevice: false,
            })
          : await authClient.twoFactor.verifyBackupCode({
              code: normalizedCode,
              disableSession: false,
              trustDevice: false,
            });

      if (response.error) {
        setError(challengeError(response.error));
        return;
      }

      clearPendingChallenge();
      await navigate({ href: returnTo, replace: true });
    } catch {
      setError('Verification is temporarily unavailable. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const leaveChallenge = async () => {
    clearPendingChallenge();
    await navigate({ to: '/login', replace: true });
  };

  return (
    <AuthCard
      title="Two-factor verification"
      description={
        mode === 'totp'
          ? 'Enter the current code from your authenticator app.'
          : 'Use one of the backup codes you saved during setup.'
      }
      footerText=""
      footerLinkText=""
      footerLinkTo=""
    >
      <div
        className="mb-5 flex rounded-2xl bg-muted/50 p-1"
        role="group"
        aria-label="Verification method"
      >
        <Button
          type="button"
          variant={mode === 'totp' ? 'secondary' : 'ghost'}
          aria-pressed={mode === 'totp'}
          onClick={() => changeMode('totp')}
          className="flex-1"
        >
          <ShieldCheck aria-hidden="true" />
          Authenticator
        </Button>
        <Button
          type="button"
          variant={mode === 'backup' ? 'secondary' : 'ghost'}
          aria-pressed={mode === 'backup'}
          onClick={() => changeMode('backup')}
          className="flex-1"
        >
          <KeyRound aria-hidden="true" />
          Backup code
        </Button>
      </div>

      <form onSubmit={verify} className="space-y-4" noValidate>
        {mode === 'totp' ? (
          <TotpCodeInput
            value={totpDigits}
            onChange={setTotpDigits}
            disabled={isSubmitting}
            errorId={error ? 'challenge-error' : undefined}
            autoFocus
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="backup-code">Backup code</Label>
            <Input
              id="backup-code"
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              autoComplete="one-time-code"
              spellCheck={false}
              autoCapitalize="none"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'challenge-error' : undefined}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
        )}

        <FormErrorMessage id="challenge-error" message={error} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner /> Verifying...
            </>
          ) : (
            'Verify and continue'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={leaveChallenge}
          disabled={isSubmitting}
        >
          Back to sign in
        </Button>
      </form>
    </AuthCard>
  );
}
