import { Redirect, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { authClient } from '../lib/auth-client'

export default function Dashboard() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  const onLogout = async () => {
    await authClient.signOut()
    router.replace('/login')
  }

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  // Only authenticated users may see the dashboard.
  if (!session) {
    return <Redirect href="/login" />
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.welcome}>
        Welcome, <Text style={styles.name}>{session.user.name}</Text>!
      </Text>
      <Text style={styles.email}>Logged in as {session.user.email}</Text>
      <Pressable style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 24, gap: 8, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  welcome: { fontSize: 16, marginTop: 8 },
  name: { fontWeight: '600' },
  email: { color: '#71717a', marginBottom: 16 },
  button: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
