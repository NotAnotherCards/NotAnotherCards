import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { usePreventScreenCapture } from 'expo-screen-capture';
import QRCode from 'react-native-qrcode-svg';
import { authClient } from '@/lib/auth-client';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Text } from './ui/text';

type EnrollmentMaterial = {
  totpURI: string;
  backupCodes: string[];
};

type ManagementAction = 'regenerate' | 'disable';

export function secretFromTotpUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

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

function SensitiveContent({ children }: { children: ReactNode }) {
  // This component only mounts while a setup key or backup codes are visible.
  // Supported Android and iOS versions block screenshots and recordings.
  usePreventScreenCapture('notanothercards-two-factor-secrets');
  return <>{children}</>;
}

function PasswordField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <View className="gap-1">
      <Label nativeID="two-factor-password-label" htmlFor="two-factor-password">
        Current password
      </Label>
      <Input
        nativeID="two-factor-password"
        aria-labelledby="two-factor-password-label"
        accessibilityLabel="Current password"
        value={value}
        onChangeText={onChange}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        editable={!disabled}
      />
    </View>
  );
}

function BackupCodes({
  codes,
  title,
  onDone,
}: {
  codes: string[];
  title: string;
  onDone: () => void;
}) {
  return (
    <SensitiveContent>
      <View className="gap-4">
        <View className="gap-1">
          <Text className="font-semibold">{title}</Text>
          <Text className="text-sm text-muted-foreground">
            This is the only time these codes will be shown. Store them
            securely; each code works once.
          </Text>
        </View>
        <View className="gap-2 rounded-xl border border-border bg-muted/30 p-4">
          {codes.map((code) => (
            <Text key={code} selectable className="text-center font-mono">
              {code}
            </Text>
          ))}
        </View>
        <Button onPress={onDone}>
          <Text>I saved my codes</Text>
        </Button>
      </View>
    </SensitiveContent>
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
  const [code, setCode] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const secret = useMemo(
    () => (material ? secretFromTotpUri(material.totpURI) : ''),
    [material],
  );

  const enable = async () => {
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

  const verify = async () => {
    if (!material) return;
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
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
      setCode('');
      await onVerified(backupCodes);
    } catch {
      setError('Could not verify the code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!material) {
    return (
      <View className="gap-4">
        <PasswordField
          value={password}
          onChange={setPassword}
          disabled={isSubmitting}
        />
        {error ? (
          <Text accessibilityRole="alert" className="text-destructive">
            {error}
          </Text>
        ) : null}
        <View className="flex-row gap-2">
          <Button loading={isSubmitting} onPress={enable} className="flex-1">
            <Text>Continue</Text>
          </Button>
          <Button variant="ghost" disabled={isSubmitting} onPress={onCancel}>
            <Text>Cancel</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <SensitiveContent>
      <View className="gap-5">
        <View className="items-center gap-3">
          <View className="rounded-xl bg-white p-3">
            <QRCode value={material.totpURI} size={176} />
          </View>
          <View className="w-full gap-1">
            <Label nativeID="manual-key-label" htmlFor="manual-key">
              Manual setup key
            </Label>
            <Input
              nativeID="manual-key"
              aria-labelledby="manual-key-label"
              accessibilityLabel="Manual setup key"
              value={secret}
              editable={false}
              selectTextOnFocus
              className="font-mono"
            />
            <Button
              variant="outline"
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(secret);
                  setCopyStatus('Setup key copied.');
                } catch {
                  setCopyStatus('Select the setup key and copy it manually.');
                }
              }}
            >
              <Text>Copy manual setup key</Text>
            </Button>
            {copyStatus ? (
              <Text
                accessibilityLiveRegion="polite"
                className="text-sm text-muted-foreground"
              >
                {copyStatus}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="gap-1">
          <Label nativeID="setup-code-label" htmlFor="setup-code">
            Authentication code
          </Label>
          <Input
            nativeID="setup-code"
            aria-labelledby="setup-code-label"
            accessibilityLabel="Authentication code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            editable={!isSubmitting}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" className="text-destructive">
            {error}
          </Text>
        ) : null}
        <Button loading={isSubmitting} onPress={verify}>
          <Text>Verify and enable</Text>
        </Button>
        <Button variant="ghost" disabled={isSubmitting} onPress={onCancel}>
          <Text>Cancel setup</Text>
        </Button>
      </View>
    </SensitiveContent>
  );
}

export function TwoFactorSecurity() {
  const { data: session, refetch } = authClient.useSession();
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [action, setAction] = useState<ManagementAction | null>(null);
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupCodesTitle, setBackupCodesTitle] = useState(
    'Save your backup codes',
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const manage = async () => {
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
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          Protect your account with an authenticator app and recovery codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        <View className="gap-1 rounded-xl border border-border bg-muted/20 p-4">
          <Text className="font-medium">
            {isEnabled ? 'Two-factor is enabled' : 'Two-factor is off'}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {isEnabled
              ? 'You will be asked for a code when signing in.'
              : 'Add an extra verification step to password sign-in.'}
          </Text>
        </View>

        {!isEnabled && hasCredential === false ? (
          <View className="gap-1 rounded-xl border border-border p-4">
            <Text className="font-semibold">A password is required</Text>
            <Text className="text-sm text-muted-foreground">
              Create a password for this account before enabling two-factor
              authentication.
            </Text>
          </View>
        ) : null}

        {!isEnabled && showEnrollment ? (
          <Enrollment
            onCancel={() => setShowEnrollment(false)}
            onVerified={async (codes) => {
              setBackupCodes(codes);
              setBackupCodesTitle('Save your backup codes');
              setShowEnrollment(false);
              setEnabledOverride(true);
              await refetch();
            }}
          />
        ) : null}

        {!isEnabled && !showEnrollment ? (
          <Button
            disabled={hasCredential !== true}
            onPress={() => setShowEnrollment(true)}
          >
            <Text>Enable two-factor authentication</Text>
          </Button>
        ) : null}

        {isEnabled && backupCodes ? (
          <BackupCodes
            codes={backupCodes}
            title={backupCodesTitle}
            onDone={resetAction}
          />
        ) : null}

        {isEnabled && action && !backupCodes ? (
          <View className="gap-4 rounded-xl border border-border p-4">
            <View className="gap-1">
              <Text className="font-semibold">
                {action === 'regenerate'
                  ? 'Regenerate backup codes'
                  : 'Disable two-factor authentication'}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {action === 'regenerate'
                  ? 'Your existing backup codes will stop working.'
                  : 'Your authenticator and all backup codes will stop working.'}
              </Text>
            </View>
            <PasswordField
              value={password}
              onChange={setPassword}
              disabled={isSubmitting}
            />
            {error ? (
              <Text accessibilityRole="alert" className="text-destructive">
                {error}
              </Text>
            ) : null}
            <Button
              variant={action === 'disable' ? 'destructive' : 'default'}
              loading={isSubmitting}
              onPress={manage}
            >
              <Text>
                {action === 'regenerate'
                  ? 'Generate new codes'
                  : 'Disable two-factor'}
              </Text>
            </Button>
            <Button
              variant="ghost"
              disabled={isSubmitting}
              onPress={resetAction}
            >
              <Text>Cancel</Text>
            </Button>
          </View>
        ) : null}

        {isEnabled && !action && !backupCodes ? (
          <View className="gap-2">
            <Button variant="outline" onPress={() => setAction('regenerate')}>
              <Text>Regenerate backup codes</Text>
            </Button>
            <Button variant="destructive" onPress={() => setAction('disable')}>
              <Text>Disable two-factor</Text>
            </Button>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
