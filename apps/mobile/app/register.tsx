import { Link } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

export default function Register() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      <Link href="/login" style={styles.link}>
        Already have an account? Log in
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  link: { color: '#1a759f' },
})
