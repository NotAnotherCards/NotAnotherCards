import { Link, type Href } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footerText: string
  footerLinkText: string
  footerLinkTo: Href
}

export function AuthCard({
  title,
  description,
  children,
  footerText,
  footerLinkText,
  footerLinkTo,
}: AuthCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {children}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{footerText} </Text>
          <Link href={footerLinkTo} style={styles.footerLink}>
            {footerLinkText}
          </Link>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f4f4f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  title: { fontSize: 24, fontWeight: '600' },
  description: { color: '#71717a', marginBottom: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerText: { color: '#71717a' },
  footerLink: { color: '#18181b', fontWeight: '600' },
})
