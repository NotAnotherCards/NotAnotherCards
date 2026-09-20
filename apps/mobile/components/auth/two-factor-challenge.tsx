import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { authClient } from '@/lib/auth-client';
import {
  beginTwoFactorChallenge,
  finishTwoFactorChallenge,
  isTerminalTwoFactorChallengeError,
  twoFactorChallengeError,
} from '@/lib/two-factor-challenge';
import { AuthCard } from './auth-card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Text } from '../ui/text';

type ChallengeMode = 'totp' | 'backup';

export function TwoFactorChallenge() {
  const router = useRouter();
  usePreventScreenCapture('notanothercards-two-factor-challenge');
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);

  useEffect(() => {
    void beginTwoFactorChallenge();
  }, []);

  useEffect(() => {
    if (!verifiedUserId || session?.user.id !== verifiedUserId) return;
    void finishTwoFactorChallenge().then(() => {
      router.replace(
        session.user.onBoardingComplete ? '/dashboard' : '/onboarding',
      );
    });
  }, [verifiedUserId, session, router]);

  const changeMode = (next: ChallengeMode) => {
    setMode(next);
    setCode('');
    setError(null);
  };

  const leaveChallenge = async () => {
    setIsSubmitting(true);
    try {
      // Clears the temporary challenge cookie from SecureStore. There is no
      // authenticated session at this point, so no account database is
      // selected or deleted.
      await authClient.signOut();
    } catch {
      // @better-auth/expo clears local auth storage when signOut starts. The
      // server-side challenge is short lived if the network cannot be reached.
    } finally {
      await finishTwoFactorChallenge();
      router.replace('/login');
    }
  };

  const verify = async () => {
    const normalizedCode = code.trim();
    if (mode === 'totp' && !/^\d{6}$/.test(normalizedCode)) {
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

      if (response.error || !response.data) {
        if (isTerminalTwoFactorChallengeError(response.error)) {
          Alert.alert(
            'Sign-in could not continue',
            twoFactorChallengeError(response.error),
          );
          await leaveChallenge();
          return;
        }
        setError(twoFactorChallengeError(response.error));
        return;
      }

      setVerifiedUserId(response.data.user.id);
    } catch {
      setError('Verification is temporarily unavailable. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
      footerLinkTo="/login"
    >
      <View
        className="mb-2 flex-row rounded-md bg-muted p-1"
        accessibilityRole="tablist"
        accessibilityLabel="Verification method"
      >
        <Button
          variant={mode === 'totp' ? 'secondary' : 'ghost'}
          onPress={() => changeMode('totp')}
          className="flex-1"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'totp' }}
        >
          <Text>Authenticator</Text>
        </Button>
        <Button
          variant={mode === 'backup' ? 'secondary' : 'ghost'}
          onPress={() => changeMode('backup')}
          className="flex-1"
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'backup' }}
        >
          <Text>Backup code</Text>
        </Button>
      </View>

      <View className="gap-1">
        <Label nativeID="two-factor-code-label" htmlFor="two-factor-code">
          {mode === 'totp' ? 'Authentication code' : 'Backup code'}
        </Label>
        <Input
          nativeID="two-factor-code"
          aria-labelledby="two-factor-code-label"
          accessibilityLabel={
            mode === 'totp' ? 'Authentication code' : 'Backup code'
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

      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-center text-destructive"
        >
          {error}
        </Text>
      ) : null}

      <Button
        loading={isSubmitting || Boolean(verifiedUserId)}
        onPress={verify}
      >
        <Text>Verify and continue</Text>
      </Button>
      <Button
        variant="ghost"
        disabled={isSubmitting || Boolean(verifiedUserId)}
        onPress={leaveChallenge}
      >
        <Text>Back to sign in</Text>
      </Button>
    </AuthCard>
  );
}
