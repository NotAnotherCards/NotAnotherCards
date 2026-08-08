import { useState } from 'react'
import { View } from 'react-native'
import { useDatabase } from '@remelondb/core/react'
import { manager } from '@/lib/db'
import { createDeck } from '@/lib/queries'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function DeckCreate() {
  const db = useDatabase(manager)
  const [title, setTitle] = useState('')

  const onAdd = async () => {
    const trimmed = title.trim()
    if (!db || !trimmed) return
    await createDeck(db, trimmed)
    setTitle('')
  }

  return (
    <View className="flex-row items-center gap-2">
      <Input
        className="flex-1"
        placeholder="New deck title"
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={onAdd}
        returnKeyType="done"
      />
      <Button label="Add" onPress={onAdd} disabled={!db} />
    </View>
  )
}
