import { View } from 'react-native'
import { useDatabase, useQuery } from '@remelondb/core/react'
import { manager } from '@/lib/db'
import { getDecksQuery } from '@/lib/queries'
import { Text } from './ui/text'

export function DeckList() {
  const db = useDatabase(manager)
  const { data: decks, isLoading } = useQuery(db && getDecksQuery(db))

  if (isLoading) return null

  if (decks.length === 0) {
    return (
      <Text className="text-muted-foreground">
        No decks yet. Create your first one.
      </Text>
    )
  }

  return (
    <View className="gap-2">
      {decks.map((deck) => (
        <View key={deck.id} className="rounded-lg border border-border p-4">
          <Text testID="deck-title" className="text-lg font-semibold">
            {deck.title}
          </Text>
          {deck.description ? (
            <Text className="text-sm text-muted-foreground">
              {deck.description}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}
