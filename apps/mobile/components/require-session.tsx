import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from './ui/button';
import { Text } from './ui/text';

// The guard every signed-in screen needs, in one place: spinner while the
// session loads, retry on a failed fetch (server down is not "logged out"),
// /login without a session, /onboarding until the server-owned flag is set.
export function RequireSession({ children }: { children: ReactNode }) {
  const { data: session, isPending, error, refetch } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-center text-destructive">
          {apiErrorMessage(error)}
        </Text>
        <Button onPress={() => refetch()}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (!session.user.onBoardingComplete) return <Redirect href="/onboarding" />;

  return <>{children}</>;
}
