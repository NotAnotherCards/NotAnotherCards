import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen,
  Library,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { authClient } from '@/lib/auth-client';
import { iconColors } from '@/lib/theme';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { DeckList } from '@/components/deck-list';
import { RequireSession } from '@/components/require-session';
import { Settings } from '@/components/settings';

// Web's dashboard strip: Overview, My Library, Profile & Settings, same
// icons. Tab state lives here like web's, no native tab navigator. The
// strip is the screen's top bar; the native header is hidden in _layout.
type Tab = 'overview' | 'library' | 'settings';

const TABS: readonly { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'overview', label: 'Overview', icon: BookOpen },
  { value: 'library', label: 'My Library', icon: Library },
  { value: 'settings', label: 'Profile & Settings', icon: SettingsIcon },
];

export default function Dashboard() {
  const { data: session } = authClient.useSession();
  const { colorScheme } = useColorScheme();
  const colors = iconColors(colorScheme);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <RequireSession>
      <View className="flex-1 bg-background">
        <View
          className="border-b border-border bg-card px-4 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Segmented
            label="Dashboard sections"
            value={tab}
            options={TABS}
            onChange={setTab}
            stacked
            renderIcon={(value, selected) => {
              const Icon = TABS.find((item) => item.value === value)!.icon;
              return (
                <Icon
                  size={18}
                  color={selected ? colors.foreground : colors.mutedForeground}
                />
              );
            }}
          />
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-4 p-6">
          {tab === 'overview' && (
            <View className="gap-1">
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
        </ScrollView>
      </View>
    </RequireSession>
  );
}
