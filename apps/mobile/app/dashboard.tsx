import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import {
  BookOpen,
  Library,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { authClient } from '@/lib/auth-client';
import { iconColors } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { DeckList } from '@/components/deck-list';
import { RequireSession } from '@/components/require-session';
import { Settings } from '@/components/settings';

// Web's dashboard strip: Overview, My Library, Profile & Settings, same
// icons. Tab state lives here like web's, no native tab navigator.
type Tab = 'overview' | 'library' | 'settings';

const TABS: readonly { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'overview', label: 'Overview', icon: BookOpen },
  { value: 'library', label: 'My Library', icon: Library },
  { value: 'settings', label: 'Profile & Settings', icon: SettingsIcon },
];

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { colorScheme } = useColorScheme();
  const colors = iconColors(colorScheme);
  const [tab, setTab] = useState<Tab>('overview');

  // SessionDatabaseProvider closes the offline database when the session
  // goes away; nothing to do here beyond signing out.
  //
  // @better-auth/expo clears the stored session while the request is being
  // built (its init hook), so whatever the server answers, this device is
  // already logged out and /login is the only coherent destination. What
  // we owe the user is the truth when the server was not reached: the
  // server-side session then lives on until it expires (#237).
  const onLogout = async () => {
    let failed = false;
    try {
      const result = await authClient.signOut();
      failed = result?.error != null;
    } catch {
      failed = true;
    }
    if (failed) {
      Alert.alert(
        'Signed out on this device only',
        'The server could not be reached, so your session elsewhere may stay active until it expires.',
      );
    }
    router.replace('/login');
  };

  return (
    <RequireSession>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-6"
      >
        <Segmented
          label="Dashboard sections"
          value={tab}
          options={TABS}
          onChange={setTab}
          renderIcon={(value, selected) => {
            const Icon = TABS.find((item) => item.value === value)!.icon;
            return (
              <Icon
                size={14}
                color={selected ? colors.foreground : colors.mutedForeground}
              />
            );
          }}
        />

        {tab === 'overview' && (
          <View className="gap-1">
            <Text className="text-2xl font-semibold">Dashboard</Text>
            <Text className="text-base">
              Welcome,{' '}
              <Text className="font-semibold">{session?.user.name}</Text>!
            </Text>
            <Text className="text-muted-foreground">
              Logged in as {session?.user.email}
            </Text>
          </View>
        )}
        {tab === 'library' && <DeckList />}
        {tab === 'settings' && <Settings />}

        <View className="gap-2 pt-4">
          <Button onPress={onLogout}>
            <Text>Log out</Text>
          </Button>
        </View>
      </ScrollView>
    </RequireSession>
  );
}
