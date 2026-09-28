import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
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

function challengeError(error: unknown, t: (key: string) => string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  if (code === 'ACCOUNT_TEMPORARILY_LOCKED') {
    return t('auth.error.two_factor_locked');
  }
  if (code === 'INVALID_BACKUP_CODE') {
    return t('auth.error.two_factor_invalid_backup');
  }
  if (code === 'INVALID_CODE') {
    return t('auth.error.two_factor_invalid_code');
  }
  if (code === 'INVALID_TWO_FACTOR_COOKIE') {
    return t('auth.error.two_factor_expired');
  }
  return t('auth.error.two_factor_failed');
}

export function TwoFactorChallenge({ redirect }: { redirect?: string }) {
  const { t } = useTranslation();
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
      setError(t('auth.error.two_factor_empty_totp'));
      return;
    }
    if (mode === 'backup' && !normalizedCode) {
      setError(t('auth.error.two_factor_empty_backup'));
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
        setError(challengeError(response.error, t));
        return;
      }

      clearPendingChallenge();
      await navigate({ href: returnTo, replace: true });
    } catch {
      setError(t('auth.error.two_factor_unavailable'));
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
      title={t('auth.two_factor.title')}
      description={
        mode === 'totp'
          ? t('auth.two_factor.description_totp')
          : t('auth.two_factor.description_backup')
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
          {t('auth.two_factor.authenticator')}
        </Button>
        <Button
          type="button"
          variant={mode === 'backup' ? 'secondary' : 'ghost'}
          aria-pressed={mode === 'backup'}
          onClick={() => changeMode('backup')}
          className="flex-1"
        >
          <KeyRound aria-hidden="true" />
          {t('auth.two_factor.backup_code')}
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
            <Label htmlFor="backup-code">
              {t('auth.two_factor.backup_code')}
            </Label>
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
              <Spinner /> {t('auth.two_factor.verifying')}
            </>
          ) : (
            t('auth.two_factor.verify_and_continue')
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={leaveChallenge}
          disabled={isSubmitting}
        >
          {t('auth.two_factor.back_to_sign_in')}
        </Button>
      </form>
    </AuthCard>
  );
}
