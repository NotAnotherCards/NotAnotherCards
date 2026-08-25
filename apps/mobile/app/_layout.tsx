import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { manager } from '@/lib/db';
import { DatabaseBanner } from '@/components/database-banner';
import { useColorScheme } from 'nativewind';
import { applySavedThemePreference, navigationColors } from '@/lib/theme';

// Before first render so the saved theme never flashes the wrong scheme.
applySavedThemePreference();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const nav = navigationColors[colorScheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    if (manager.state.status === 'idle' || manager.state.status === 'error') {
      // The banner shows the failure to the user; log it too, otherwise the
      // reason is invisible when debugging on a device.
      manager.init().catch((error: unknown) => {
        console.error('opening the offline database failed', error);
      });
    }
  }, []);

  return (
    <>
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
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
