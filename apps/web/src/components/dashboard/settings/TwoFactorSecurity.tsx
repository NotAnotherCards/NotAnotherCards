import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Clipboard,
  Download,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import {
  emptyTotpDigits,
  TotpCodeInput,
} from '@/components/auth/totp-code-input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';

type EnrollmentMaterial = {
  totpURI: string;
  backupCodes: string[];
};

function managementError(error: unknown, fallback: string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  if (code === 'INVALID_PASSWORD') return 'The current password is incorrect.';
  if (code === 'TWO_FACTOR_ALREADY_ENABLED') {
    return 'Two-factor authentication is already enabled.';
  }
  return fallback;
}

function secretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

function BackupCodes({
  codes,
  title = 'Save your backup codes',
  onDone,
}: {
  codes: string[];
  title?: string;
  onDone: () => void;
}) {
  const download = () => {
    const file = new Blob(
      [
        `NotAnotherCards backup codes\n\n${codes.join('\n')}\n\nEach code can only be used once.`,
      ],
      { type: 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'notanothercards-backup-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" aria-labelledby="backup-code-title">
      <div>
        <h4 id="backup-code-title" className="font-semibold">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground">
          This is the only time these codes will be shown. Keep them somewhere
          secure; each code works once.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 rounded-2xl border bg-muted/30 p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li
            key={code}
            className="select-all rounded-lg bg-background px-3 py-2 text-center"
          >
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={download}>
          <Download aria-hidden="true" />
          Download codes
        </Button>
        <Button type="button" onClick={onDone}>
          <Check aria-hidden="true" />I saved my codes
        </Button>
      </div>
    </div>
  );
}

function Enrollment({
  onCancel,
  onVerified,
}: {
  onCancel: () => void;
  onVerified: (backupCodes: string[]) => void | Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [material, setMaterial] = useState<EnrollmentMaterial | null>(null);
  const [code, setCode] = useState(emptyTotpDigits);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const secret = useMemo(
    () => (material ? secretFromUri(material.totpURI) : ''),
    [material],
  );

  // Enrollment material is intentionally component-local. Canceling, leaving
  // Security settings, refreshing, or navigating back unmounts this component
  // and removes the secret and codes from application state.

  const enable = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Enter your current password to continue.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authClient.twoFactor.enable({
        password,
        issuer: 'NotAnotherCards',
      });
      if (response.error || !response.data) {
        setError(
          managementError(
            response.error,
            'Could not start two-factor setup. Please try again.',
          ),
        );
        return;
      }
      setMaterial({
        totpURI: response.data.totpURI,
        backupCodes: [...response.data.backupCodes],
      });
      setPassword('');
    } catch {
      setError('Could not start two-factor setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!material) return;
    const normalizedCode = code.join('');
    if (normalizedCode.length !== 6) {
      setError('Enter the six-digit code from your authenticator app.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authClient.twoFactor.verifyTotp({
        code: normalizedCode,
      });
      if (response.error) {
        setError('That code is invalid or has expired. Try the current code.');
        return;
      }
      const backupCodes = [...material.backupCodes];
      setMaterial(null);
      setCode(emptyTotpDigits());
      await onVerified(backupCodes);
    } catch {
      setError('Could not verify the code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!material) {
    return (
      <form onSubmit={enable} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="two-factor-password">Current password</Label>
          <PasswordInput
            id="two-factor-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'enrollment-error' : undefined}
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <FormErrorMessage id="enrollment-error" message={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : <ShieldCheck aria-hidden="true" />}
            {isSubmitting ? 'Starting setup...' : 'Continue'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG
            value={material.totpURI}
            size={176}
            title="Scan this QR code with your authenticator app"
          />
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold">Scan the QR code</h4>
            <p className="text-sm text-muted-foreground">
              Add it in your authenticator app, then enter the code it shows.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-secret">Manual setup key</Label>
            <div className="flex gap-2">
              <Input
                id="manual-secret"
                value={secret}
                readOnly
                className="font-mono"
                aria-describedby="manual-secret-help copy-status"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy manual setup key"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret);
                    setCopyStatus('Setup key copied.');
                  } catch {
                    setCopyStatus('Select the setup key and copy it manually.');
                  }
                }}
              >
                <Clipboard aria-hidden="true" />
              </Button>
            </div>
            <p
              id="manual-secret-help"
              className="text-xs text-muted-foreground"
            >
              Use this key if your app cannot scan the QR code.
            </p>
            <p id="copy-status" className="sr-only" aria-live="polite">
              {copyStatus}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={verify} className="space-y-4">
        <TotpCodeInput
          value={code}
          onChange={setCode}
          disabled={isSubmitting}
          errorId={error ? 'enrollment-error' : undefined}
          autoFocus
        />
        <FormErrorMessage id="enrollment-error" message={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : <ShieldCheck aria-hidden="true" />}
            {isSubmitting ? 'Verifying...' : 'Verify and enable'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel setup
          </Button>
        </div>
      </form>
    </div>
  );
}

export function TwoFactorSecurity() {
  const navigate = useNavigate();
  const { data: session, refetch } = authClient.useSession();
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [action, setAction] = useState<'regenerate' | 'disable' | null>(null);
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupCodesTitle, setBackupCodesTitle] = useState(
    'Save your backup codes',
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingCredential, setIsCreatingCredential] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const isEnabled = enabledOverride ?? Boolean(session?.user.twoFactorEnabled);

  useEffect(() => {
    let active = true;
    void authClient
      .listAccounts()
      .then(({ data, error: accountsError }) => {
        if (!active) return;
        if (accountsError || !data) {
          setHasCredential(null);
          return;
        }
        setHasCredential(
          data.some((account) => account.providerId === 'credential'),
        );
      })
      .catch(() => {
        if (active) setHasCredential(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const resetAction = () => {
    setAction(null);
    setPassword('');
    setError(null);
    setBackupCodes(null);
  };

  const startCredentialCreation = async () => {
    setCredentialError(null);
    setIsCreatingCredential(true);
    try {
      const response = await authClient.signOut();
      if (response.error) {
        setCredentialError(
          response.error.message ||
            'Could not sign out. Please try again before creating a password.',
        );
        return;
      }
      await navigate({
        to: '/forgot-password',
        search: { email: session?.user.email },
      });
    } catch {
      setCredentialError(
        'Could not sign out. Please try again before creating a password.',
      );
    } finally {
      setIsCreatingCredential(false);
    }
  };

  const manage = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Enter your current password to continue.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (action === 'regenerate') {
        const response = await authClient.twoFactor.generateBackupCodes({
          password,
        });
        if (response.error || !response.data) {
          setError(
            managementError(
              response.error,
              'Could not regenerate backup codes. Please try again.',
            ),
          );
          return;
        }
        setBackupCodes([...response.data.backupCodes]);
        setBackupCodesTitle('Your new backup codes');
        setPassword('');
      } else if (action === 'disable') {
        const response = await authClient.twoFactor.disable({ password });
        if (response.error) {
          setError(
            managementError(
              response.error,
              'Could not disable two-factor authentication. Please try again.',
            ),
          );
          return;
        }
        setEnabledOverride(false);
        resetAction();
        await refetch();
      }
    } catch {
      setError('The security change could not be completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-3xl border border-border/60 shadow-xs">
      <CardHeader className="flex flex-row items-center gap-3 pb-4">
        <div className="rounded-2xl bg-primary/10 p-2 text-primary">
          <KeyRound className="size-5" aria-hidden="true" />
        </div>
        <div>
          <CardTitle
            role="heading"
            aria-level={3}
            className="text-base font-bold"
          >
            Two-factor authentication
          </CardTitle>
          <CardDescription className="text-xs">
            Protect your account with an authenticator app and recovery codes.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/20 p-4">
          <div>
            <p className="font-medium">
              {isEnabled ? 'Two-factor is enabled' : 'Two-factor is off'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEnabled
                ? 'You will be asked for a code when signing in.'
                : 'Add an extra verification step to password sign-in.'}
            </p>
          </div>
          <span
            className={
              isEnabled
                ? 'rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400'
                : 'rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground'
            }
          >
            {isEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {!isEnabled && hasCredential === false && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold">A password is required</p>
            <p className="text-muted-foreground">
              Social-only accounts cannot enable two-factor authentication yet.
              Sign out, then create a password for this email through the
              password reset flow.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={startCredentialCreation}
              disabled={isCreatingCredential}
            >
              {isCreatingCredential && <Spinner />}
              {isCreatingCredential
                ? 'Signing out...'
                : 'Sign out and create a password'}
            </Button>
            <FormErrorMessage className="mt-3" message={credentialError} />
          </div>
        )}

        {!isEnabled && showEnrollment && (
          <Enrollment
            onCancel={() => setShowEnrollment(false)}
            onVerified={async (codes) => {
              // Lift the one-time codes before refreshing the shared session.
              // The refresh changes twoFactorEnabled and unmounts Enrollment.
              setBackupCodes(codes);
              setBackupCodesTitle('Save your backup codes');
              setShowEnrollment(false);
              setEnabledOverride(true);
              await refetch();
            }}
          />
        )}

        {!isEnabled && !showEnrollment && (
          <Button
            type="button"
            onClick={() => setShowEnrollment(true)}
            disabled={hasCredential !== true}
          >
            <ShieldCheck aria-hidden="true" />
            Enable two-factor authentication
          </Button>
        )}

        {isEnabled && backupCodes && (
          <BackupCodes
            title={backupCodesTitle}
            codes={backupCodes}
            onDone={resetAction}
          />
        )}

        {isEnabled && action && !backupCodes && (
          <form onSubmit={manage} className="space-y-4 rounded-2xl border p-4">
            <div>
              <h4 className="font-semibold">
                {action === 'regenerate'
                  ? 'Regenerate backup codes'
                  : 'Disable two-factor authentication'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {action === 'regenerate'
                  ? 'Your existing backup codes will stop working.'
                  : 'Your authenticator and all backup codes will stop working.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`two-factor-${action}-password`}>
                Current password
              </Label>
              <PasswordInput
                id={`two-factor-${action}-password`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'management-error' : undefined}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <FormErrorMessage id="management-error" message={error} />
            <div className="flex gap-2">
              <Button
                type="submit"
                variant={action === 'disable' ? 'destructive' : 'default'}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Spinner /> : null}
                {isSubmitting
                  ? 'Confirming...'
                  : action === 'regenerate'
                    ? 'Generate new codes'
                    : 'Disable two-factor'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetAction}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {isEnabled && !action && !backupCodes && (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAction('regenerate')}
            >
              <RefreshCw aria-hidden="true" />
              Regenerate backup codes
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setAction('disable')}
            >
              <ShieldOff aria-hidden="true" />
              Disable two-factor
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
