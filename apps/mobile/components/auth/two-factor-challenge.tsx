import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { authClient } from '@/lib/auth-client';
import { clearLocalAuthStorage } from '@/lib/auth-storage';
import {
  finishTwoFactorChallenge,
  hydrateTwoFactorChallenge,
  isTerminalTwoFactorChallengeError,
  markTwoFactorChallengeVerified,
  twoFactorChallengeError,
  useTwoFactorChallengeState,
} from '@/lib/two-factor-challenge';
import { AuthCard } from './auth-card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Text } from '../ui/text';

type ChallengeMode = 'totp' | 'backup';

export function TwoFactorChallenge() {
  const { t } = useTranslation();
  const router = useRouter();
  usePreventScreenCapture('notanothercards-two-factor-challenge');
  const {
    data: session,
    isPending: isSessionPending,
    isRefetching: isSessionRefetching,
    refetch,
  } = authClient.useSession();
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingSession, setIsConfirmingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const { hydrated, pending, verifiedUserId } = useTwoFactorChallengeState();

  useEffect(() => {
    // Sign-in and OAuth callbacks own challenge creation. Opening the database
    // can remount this screen after verification; mounting must not restart it.
    void hydrateTwoFactorChallenge();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!pending) {
      if (!isSessionPending) {
        router.replace(
          !session
            ? '/login'
            : session.user.onBoardingComplete
              ? '/dashboard'
              : '/onboarding',
        );
      }
      return;
    }
    if (!verifiedUserId) return;
    if (session?.user.id === verifiedUserId) {
      // Navigate from the completed state, including on a fresh screen instance.
      void finishTwoFactorChallenge();
      return;
    }
    if (!isConfirmingSession && !isSessionPending && !isSessionRefetching) {
      setSessionError(t('mobile.messages.session_unconfirmed'));
    }
  }, [
    hydrated,
    pending,
    isConfirmingSession,
    isSessionPending,
    isSessionRefetching,
    verifiedUserId,
    session,
    router,
  ]);

  const confirmSession = async () => {
    setSessionError(null);
    setIsConfirmingSession(true);
    try {
      await refetch();
    } catch {
      setSessionError(t('mobile.messages.session_unconfirmed'));
    } finally {
      setIsConfirmingSession(false);
    }
  };

  const changeMode = (next: ChallengeMode) => {
    setMode(next);
    setCode('');
    setError(null);
  };

  const leaveChallenge = async () => {
    setIsSubmitting(true);
    let needsLocalFallback = false;
    try {
      const response = await authClient.signOut();
      needsLocalFallback = Boolean(response.error);
    } catch {
      needsLocalFallback = true;
    }

    if (needsLocalFallback) {
      try {
        // The server-side challenge expires shortly. Clearing the device copy
        // prevents cached auth from reopening protected screens meanwhile.
        await clearLocalAuthStorage();
      } catch {
        setError(t('mobile.messages.unsafe_signout'));
        setIsSubmitting(false);
        return;
      }
    }

    await finishTwoFactorChallenge();
    router.replace('/login');
  };

  const verify = async () => {
    const normalizedCode = code.trim();
    if (mode === 'totp' && !/^\d{6}$/.test(normalizedCode)) {
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

      if (response.error || !response.data) {
        if (isTerminalTwoFactorChallengeError(response.error)) {
          Alert.alert(
            t('mobile.messages.signin_failed'),
            twoFactorChallengeError(response.error),
          );
          await leaveChallenge();
          return;
        }
        setError(twoFactorChallengeError(response.error));
        return;
      }

      markTwoFactorChallengeVerified(response.data.user.id);
      await confirmSession();
    } catch {
      setError(t('auth.error.two_factor_unavailable'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hydrated || !pending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

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
      footerLinkTo="/login"
    >
      <View
        className="mb-2 flex-row rounded-md bg-muted p-1"
        accessibilityRole="tablist"
        accessibilityLabel={t('mobile.messages.verification_method')}
      >
        <Button
          variant={mode === 'totp' ? 'secondary' : 'ghost'}
          onPress={() => changeMode('totp')}
          className="flex-1"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'totp' }}
        >
          <Text>{t('auth.two_factor.authenticator')}</Text>
        </Button>
        <Button
          variant={mode === 'backup' ? 'secondary' : 'ghost'}
          onPress={() => changeMode('backup')}
          className="flex-1"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'backup' }}
        >
          <Text>{t('auth.two_factor.backup_code')}</Text>
        </Button>
      </View>

      <View className="gap-1">
        <Label nativeID="two-factor-code-label" htmlFor="two-factor-code">
          {mode === 'totp'
            ? t('mobile.messages.authentication_code')
            : t('auth.two_factor.backup_code')}
        </Label>
        <Input
          nativeID="two-factor-code"
          aria-labelledby="two-factor-code-label"
          accessibilityLabel={
            mode === 'totp'
              ? t('mobile.messages.authentication_code')
              : t('auth.two_factor.backup_code')
          }
          value={code}
          onChangeText={setCode}
          keyboardType={mode === 'totp' ? 'number-pad' : 'default'}
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={mode === 'totp' ? 6 : undefined}
          editable={!isSubmitting && !verifiedUserId}
          className={error ? 'border-destructive' : undefined}
        />
      </View>

      {error || sessionError ? (
        <Text
          accessibilityRole="alert"
          className="text-center text-destructive"
        >
          {error ?? sessionError}
        </Text>
      ) : null}

      {verifiedUserId ? (
        <Button
          loading={
            isConfirmingSession || isSessionPending || isSessionRefetching
          }
          onPress={confirmSession}
        >
          <Text>{t('mobile.messages.retry_session')}</Text>
        </Button>
      ) : (
        <Button loading={isSubmitting} onPress={verify}>
          <Text>{t('auth.two_factor.verify_and_continue')}</Text>
        </Button>
      )}
      <Button
        variant="ghost"
        disabled={
          isSubmitting ||
          isConfirmingSession ||
          isSessionPending ||
          isSessionRefetching
        }
        onPress={leaveChallenge}
      >
        <Text>{t('auth.two_factor.back_to_sign_in')}</Text>
      </Button>
    </AuthCard>
  );
}
