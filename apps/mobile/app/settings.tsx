import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import { RequireSession } from '@/components/require-session';
import { Settings } from '@/components/settings';

export default function SettingsScreen() {
  return (
    <RequireSession>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-6"
      >
        <Settings />
      </ScrollView>
    </RequireSession>
  );
}
