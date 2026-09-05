import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { DatabaseBanner } from '@/components/database-banner';
import { useColorScheme } from 'nativewind';
import { applySavedThemePreference, navigationColors } from '@/lib/theme';
import { SessionDatabaseProvider } from '@/lib/database-provider';

// Before first render so the saved theme never flashes the wrong scheme.
applySavedThemePreference();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const nav = navigationColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <SessionDatabaseProvider>
      <DatabaseBanner />
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: nav.card },
          headerTintColor: nav.foreground,
          contentStyle: {
            backgroundColor: nav.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: nav.border,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Log in' }} />
        <Stack.Screen name="register" options={{ title: 'Register' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Set up profile' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      </Stack>
      <StatusBar style="auto" />
    </SessionDatabaseProvider>
  );
}
