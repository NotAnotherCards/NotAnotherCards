import { Link } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

export default function Login() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      <Link href="/register" style={styles.link}>
        Need an account? Register
      </Link>
      <Link href="/dashboard" style={styles.link}>
        Go to dashboard
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  link: { color: '#1a759f' },
})
