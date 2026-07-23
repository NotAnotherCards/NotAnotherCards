import { StyleSheet, Text, View } from 'react-native'

// Auth gating is added in a later step; for now the screen is reachable
// so navigation can be verified end to end.
export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>protected content goes here</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { color: '#888' },
})
