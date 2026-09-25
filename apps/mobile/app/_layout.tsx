import '../global.css';
import '@/lib/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DatabaseBanner } from '@/components/database-banner';
import { useColorScheme } from 'nativewind';
import { applySavedThemePreference, navigationColors } from '@/lib/theme';
import { SessionDatabaseProvider } from '@/lib/database-provider';

// Before first render so the saved theme never flashes the wrong scheme.
applySavedThemePreference();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const nav = navigationColors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Gestures (the review card's swipe) need one root view around the app.
  return (
    <GestureHandlerRootView style={styles.root}>
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
          <Stack.Screen
            name="onboarding"
            options={{ title: 'Set up profile' }}
          />
          {/* The tab strip is the dashboard's top bar, as on web. Screens
            pushed from it (deck, review) keep the native header and its
            back arrow. */}
          <Stack.Screen
            name="dashboard"
            options={{ title: 'Dashboard', headerShown: false }}
          />
        </Stack>
        <StatusBar style="auto" />
      </SessionDatabaseProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
