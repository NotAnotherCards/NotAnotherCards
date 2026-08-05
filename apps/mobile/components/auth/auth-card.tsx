import { Link, type Href } from 'expo-router'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'

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
    <View className="flex-1 justify-center bg-background p-6">
      <View className="gap-3 rounded-xl border border-border bg-card p-6">
        <Text className="text-2xl font-semibold">{title}</Text>
        <Text className="mb-2 text-muted-foreground">{description}</Text>
        {children}
        <View className="mt-1 flex-row justify-center">
          <Text className="text-muted-foreground">{footerText} </Text>
          <Link href={footerLinkTo} asChild>
            <Text className="font-semibold">{footerLinkText}</Text>
          </Link>
        </View>
      </View>
    </View>
  )
}
