import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ThemeToggle } from '@/components/theme-toggle';
import { DeckList } from '@/components/deck-list';
import { RequireSession } from '@/components/require-session';

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

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

  return (
    <RequireSession>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-6"
      >
        <View className="gap-1">
          <Text className="text-2xl font-semibold">Dashboard</Text>
          <Text className="text-base">
            Welcome, <Text className="font-semibold">{session?.user.name}</Text>
            !
          </Text>
          <Text className="text-muted-foreground">
            Logged in as {session?.user.email}
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
    </RequireSession>
  );
}
