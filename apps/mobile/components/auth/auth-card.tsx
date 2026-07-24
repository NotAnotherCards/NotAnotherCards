import { Link, type Href } from 'expo-router'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Card } from '../ui/card'
import { Text } from '../ui/text'

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
    <View className="flex-1 justify-center bg-zinc-100 p-6">
      <Card className="gap-3">
        <Text className="text-2xl font-semibold">{title}</Text>
        <Text className="mb-2 text-zinc-500">{description}</Text>
        {children}
        <View className="mt-1 flex-row justify-center">
          <Text className="text-zinc-500">{footerText} </Text>
          <Link href={footerLinkTo} asChild>
            <Text className="font-semibold">{footerLinkText}</Text>
          </Link>
        </View>
      </Card>
    </View>
  )
}
