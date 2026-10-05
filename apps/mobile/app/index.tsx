import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  useTwoFactorChallengeState,
  useTwoFactorDeepLinkPending,
} from '@/lib/two-factor-challenge';

// Dashboard bounces unauthenticated users back to /login.
export default function Index() {
  const challenge = useTwoFactorChallengeState();
  const deepLinkPending = useTwoFactorDeepLinkPending();
  if (!challenge.hydrated) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (deepLinkPending || challenge.pending) {
    return <Redirect href="/two-factor" />;
  }
  return <Redirect href="/dashboard" />;
}
