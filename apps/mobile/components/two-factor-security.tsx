import { t } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { usePreventScreenCapture } from 'expo-screen-capture';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
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
  if (code === 'INVALID_PASSWORD')
    return t('dashboard.settings.two_factor.incorrect_password');
  if (code === 'TWO_FACTOR_ALREADY_ENABLED') {
    return t('dashboard.settings.two_factor.already_enabled');
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
  const { t } = useTranslation();
  return (
    <View className="gap-1">
      <Label nativeID="two-factor-password-label" htmlFor="two-factor-password">
        {t('dashboard.settings.two_factor.current_password')}
      </Label>
      <Input
        nativeID="two-factor-password"
        aria-labelledby="two-factor-password-label"
        accessibilityLabel={t('dashboard.settings.two_factor.current_password')}
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
  const { t } = useTranslation();
  return (
    <SensitiveContent>
      <View className="gap-4">
        <View className="gap-1">
          <Text className="font-semibold">{title}</Text>
          <Text className="text-sm text-muted-foreground">
            {t('dashboard.settings.two_factor.backup_codes_desc')}
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
          <Text>{t('dashboard.settings.two_factor.saved_codes')}</Text>
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
  const { t } = useTranslation();
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
  // A copied setup key would outlive the setup on the clipboard. When the
  // key goes away (verified, cancelled, left) it is cleared, but only if the
  // clipboard still holds it: anything copied since is the user's.
  const copiedKey = useRef<string | null>(null);
  useEffect(
    () => () => {
      const key = copiedKey.current;
      if (!key) return;
      copiedKey.current = null;
      void Clipboard.getStringAsync()
        .then((current) =>
          current === key ? Clipboard.setStringAsync('') : undefined,
        )
        .catch(() => {});
    },
    [secret],
  );

  const enable = async () => {
    if (!password) {
      setError(t('dashboard.settings.two_factor.enter_password'));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // Better Auth signals every two-factor request as a session change.
      // Starting enrollment does not change the session, and that signal can
      // remount the mobile navigator before the transient QR material is used.
      const response = await authClient.twoFactor.enable(
        {
          password,
          issuer: 'NotAnotherCards',
        },
        { disableSignal: true },
      );
      if (response.error || !response.data) {
        setError(
          managementError(
            response.error,
            t('dashboard.settings.two_factor.start_setup_fail'),
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
      setError(t('dashboard.settings.two_factor.start_setup_fail'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verify = async () => {
    if (!material) return;
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError(t('auth.error.two_factor_empty_totp'));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authClient.twoFactor.verifyTotp(
        { code: normalizedCode },
        // The parent lifts the backup codes before refreshing the session.
        // Refreshing here can remount the dashboard and hide the one-time
        // codes before the user acknowledges them.
        { disableSignal: true },
      );
      if (response.error) {
        setError(t('dashboard.settings.two_factor.invalid_code'));
        return;
      }
      const backupCodes = [...material.backupCodes];
      setMaterial(null);
      setCode('');
      await onVerified(backupCodes);
    } catch {
      setError(t('dashboard.settings.two_factor.verify_fail'));
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
            <Text>{t('dashboard.settings.two_factor.continue')}</Text>
          </Button>
          <Button variant="ghost" disabled={isSubmitting} onPress={onCancel}>
            <Text>{t('common.cancel')}</Text>
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
              {t('dashboard.settings.two_factor.manual_setup_key')}
            </Label>
            <Input
              nativeID="manual-key"
              aria-labelledby="manual-key-label"
              accessibilityLabel={t(
                'dashboard.settings.two_factor.manual_setup_key',
              )}
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
                  copiedKey.current = secret;
                  setCopyStatus(
                    t('dashboard.settings.two_factor.manual_key_copied'),
                  );
                } catch {
                  setCopyStatus(
                    t('dashboard.settings.two_factor.manual_key_copy_fail'),
                  );
                }
              }}
            >
              <Text>{t('dashboard.settings.two_factor.copy_manual_key')}</Text>
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
            {t('mobile.messages.authentication_code')}
          </Label>
          <Input
            nativeID="setup-code"
            aria-labelledby="setup-code-label"
            accessibilityLabel={t('mobile.messages.authentication_code')}
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
          <Text>{t('dashboard.settings.two_factor.verify_enable')}</Text>
        </Button>
        <Button variant="ghost" disabled={isSubmitting} onPress={onCancel}>
          <Text>{t('dashboard.settings.two_factor.cancel_setup')}</Text>
        </Button>
      </View>
    </SensitiveContent>
  );
}

export function TwoFactorSecurity() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, refetch } = authClient.useSession();
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [action, setAction] = useState<ManagementAction | null>(null);
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupCodesTitle, setBackupCodesTitle] = useState(
    t('dashboard.settings.two_factor.save_backup_codes'),
  );
  const [refreshSessionAfterCodes, setRefreshSessionAfterCodes] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingCredential, setIsCreatingCredential] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const isEnabled = enabledOverride ?? Boolean(session?.user.twoFactorEnabled);

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    setAccountError(null);
    try {
      const { data, error: accountsError } = await authClient.listAccounts();
      if (accountsError || !data) throw accountsError;
      setHasCredential(
        data.some((account) => account.providerId === 'credential'),
      );
    } catch {
      setHasCredential(null);
      setAccountError(t('mobile.messages.signin_methods_failed'));
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const resetAction = () => {
    setAction(null);
    setPassword('');
    setError(null);
    setBackupCodes(null);
    setRefreshSessionAfterCodes(false);
  };

  const acknowledgeBackupCodes = () => {
    const shouldRefreshSession = refreshSessionAfterCodes;
    resetAction();
    if (shouldRefreshSession) void refetch();
  };

  const startPasswordCreation = async () => {
    setCredentialError(null);
    setIsCreatingCredential(true);
    try {
      const response = await authClient.signOut();
      if (response.error) {
        setCredentialError(
          response.error.message ||
            t('dashboard.settings.two_factor.sign_out_fail'),
        );
        return;
      }
      router.replace({
        pathname: '/forgot-password',
        params: { email: session?.user.email ?? '' },
      });
    } catch {
      setCredentialError(t('dashboard.settings.two_factor.sign_out_fail'));
    } finally {
      setIsCreatingCredential(false);
    }
  };

  const manage = async () => {
    if (!password) {
      setError(t('dashboard.settings.two_factor.enter_password'));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (action === 'regenerate') {
        const response = await authClient.twoFactor.generateBackupCodes(
          { password },
          { disableSignal: true },
        );
        if (response.error || !response.data) {
          setError(
            managementError(
              response.error,
              t('dashboard.settings.two_factor.regenerate_fail'),
            ),
          );
          return;
        }
        setBackupCodes([...response.data.backupCodes]);
        setBackupCodesTitle(
          t('dashboard.settings.two_factor.new_backup_codes'),
        );
        setRefreshSessionAfterCodes(false);
        setPassword('');
      } else if (action === 'disable') {
        const response = await authClient.twoFactor.disable(
          { password },
          // Local state is updated before the explicit refetch below.
          { disableSignal: true },
        );
        if (response.error) {
          setError(
            managementError(
              response.error,
              t('dashboard.settings.two_factor.disable_fail'),
            ),
          );
          return;
        }
        setEnabledOverride(false);
        resetAction();
        await refetch();
      }
    } catch {
      setError(t('mobile.messages.security_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.settings.two_factor.title')}</CardTitle>
        <CardDescription>
          {t('dashboard.settings.two_factor.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        <View className="gap-1 rounded-xl border border-border bg-muted/20 p-4">
          <Text className="font-medium">
            {isEnabled
              ? t('dashboard.settings.two_factor.enabled')
              : t('dashboard.settings.two_factor.disabled')}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {isEnabled
              ? t('dashboard.settings.two_factor.enabled_desc')
              : t('dashboard.settings.two_factor.disabled_desc')}
          </Text>
        </View>

        {!isEnabled && accountError ? (
          <View className="gap-2 rounded-xl border border-destructive p-4">
            <Text accessibilityRole="alert" className="text-destructive">
              {accountError}
            </Text>
            <Button variant="outline" onPress={() => void loadAccounts()}>
              <Text>{t('mobile.messages.retry_methods')}</Text>
            </Button>
          </View>
        ) : null}

        {!isEnabled && hasCredential === false ? (
          <View className="gap-1 rounded-xl border border-border p-4">
            <Text className="font-semibold">
              {t('dashboard.settings.two_factor.password_required')}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {t('dashboard.settings.two_factor.password_required_desc')}
            </Text>
            <Button
              variant="outline"
              loading={isCreatingCredential}
              onPress={startPasswordCreation}
              className="mt-2"
            >
              <Text>
                {t('dashboard.settings.two_factor.sign_out_create_password')}
              </Text>
            </Button>
            {credentialError ? (
              <Text accessibilityRole="alert" className="text-destructive">
                {credentialError}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isEnabled && showEnrollment ? (
          <Enrollment
            onCancel={() => setShowEnrollment(false)}
            onVerified={(codes) => {
              setBackupCodes(codes);
              setBackupCodesTitle(
                t('dashboard.settings.two_factor.save_backup_codes'),
              );
              setRefreshSessionAfterCodes(true);
              setShowEnrollment(false);
              setEnabledOverride(true);
            }}
          />
        ) : null}

        {!isEnabled && !showEnrollment ? (
          <Button
            loading={isLoadingAccounts}
            disabled={isLoadingAccounts || hasCredential !== true}
            onPress={() => setShowEnrollment(true)}
          >
            <Text>{t('dashboard.settings.two_factor.enable_two_factor')}</Text>
          </Button>
        ) : null}

        {isEnabled && backupCodes ? (
          <BackupCodes
            codes={backupCodes}
            title={backupCodesTitle}
            onDone={acknowledgeBackupCodes}
          />
        ) : null}

        {isEnabled && action && !backupCodes ? (
          <View className="gap-4 rounded-xl border border-border p-4">
            <View className="gap-1">
              <Text className="font-semibold">
                {action === 'regenerate'
                  ? t('dashboard.settings.two_factor.regenerate_backup_codes')
                  : t('dashboard.settings.two_factor.disable_two_factor')}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {action === 'regenerate'
                  ? t('dashboard.settings.two_factor.regenerate_desc')
                  : t('dashboard.settings.two_factor.disable_desc')}
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
                  ? t('dashboard.settings.two_factor.generate_new_codes')
                  : t('dashboard.settings.two_factor.disable_two_factor_btn')}
              </Text>
            </Button>
            <Button
              variant="ghost"
              disabled={isSubmitting}
              onPress={resetAction}
            >
              <Text>{t('common.cancel')}</Text>
            </Button>
          </View>
        ) : null}

        {isEnabled && !action && !backupCodes ? (
          <View className="gap-2">
            <Button variant="outline" onPress={() => setAction('regenerate')}>
              <Text>
                {t('dashboard.settings.two_factor.regenerate_backup_codes')}
              </Text>
            </Button>
            <Button variant="destructive" onPress={() => setAction('disable')}>
              <Text>
                {t('dashboard.settings.two_factor.disable_two_factor_btn')}
              </Text>
            </Button>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
