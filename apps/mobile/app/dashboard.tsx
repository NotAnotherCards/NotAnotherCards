import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ThemeToggle } from '@/components/theme-toggle';
import { DeckList } from '@/components/deck-list';

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending, error, refetch } = authClient.useSession();

  // SessionDatabaseProvider closes the offline database when the session
  // goes away; nothing to do here beyond signing out.
  const onLogout = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Server unreachable - still drop back to the login screen.
    }
    router.replace('/login');
  };

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // A failed session fetch (server down) is not the same as "not logged in" -
  // offer a retry instead of bouncing to /login.
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

  // Only authenticated users may see the dashboard.
  if (!session) {
    return <Redirect href="/login" />;
  }

  // The server owns onBoardingComplete; unfinished profiles set it false.
  if (!session.user.onBoardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-6"
    >
      <View className="gap-1">
        <Text className="text-2xl font-semibold">Dashboard</Text>
        <Text className="text-base">
          Welcome, <Text className="font-semibold">{session.user.name}</Text>!
        </Text>
        <Text className="text-muted-foreground">
          Logged in as {session.user.email}
        </Text>
      </View>
      <DeckList />
      <View className="gap-2 pt-4">
        <ThemeToggle />
        <Button onPress={onLogout}>
          <Text>Log out</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
