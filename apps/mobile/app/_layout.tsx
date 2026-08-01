import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { manager } from '../lib/db'
import { DatabaseBanner } from '../components/database-banner'

export default function RootLayout() {
  useEffect(() => {
    if (manager.state.status === 'idle' || manager.state.status === 'error') {
      manager.init().catch(() => {})
    }
  }, [])

  return (
    <>
      <DatabaseBanner />
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Log in' }} />
        <Stack.Screen name="register" options={{ title: 'Register' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  )
}
