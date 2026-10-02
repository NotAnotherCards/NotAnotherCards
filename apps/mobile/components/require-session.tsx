import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from './ui/button';
import { Text } from './ui/text';
import {
  useTwoFactorChallengeState,
  useTwoFactorDeepLinkPending,
} from '@/lib/two-factor-challenge';

// The guard every signed-in screen needs, in one place: spinner while the
// session loads, retry on a failed fetch (server down is not "logged out"),
// /login without a session, /onboarding until the server-owned flag is set.
// A refetch that fails while a session is already here keeps the screen:
// unmounting it would throw away what the user is in the middle of (the
// one-time backup codes after enabling 2FA, say), and the session is still
// valid until the server says otherwise.
export function RequireSession({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const challenge = useTwoFactorChallengeState();
  const deepLinkPending = useTwoFactorDeepLinkPending();

  if (isPending || !challenge.hydrated) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (deepLinkPending || challenge.pending) {
    return <Redirect href="/two-factor" />;
  }

  if (error && !session) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-center text-destructive">
          {apiErrorMessage(error)}
        </Text>
        <Button onPress={() => refetch()}>
          <Text>{t('common.retry')}</Text>
        </Button>
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (!session.user.onBoardingComplete) return <Redirect href="/onboarding" />;

  return (
    <>
      {error && (
        <View className="flex-row items-center justify-between gap-2 px-6 py-2">
          <Text className="shrink text-sm text-destructive">
            {apiErrorMessage(error)}
          </Text>
          <Button variant="ghost" size="sm" onPress={() => refetch()}>
            <Text>{t('common.retry')}</Text>
          </Button>
        </View>
      )}
      {children}
    </>
  );
}
