import { useState } from 'react'
import { View } from 'react-native'
import { useDatabaseState } from '@remelondb/core/react'
import { manager } from '@/lib/db'
import { Button } from './ui/button'
import { Text } from './ui/text'

// Only the error state is worth showing: on native there are no tabs, so the
// taken-over state is unreachable, and idle/loading/ready need no banner.
export function DatabaseBanner() {
  const { status } = useDatabaseState(manager)
  const [isRetrying, setIsRetrying] = useState(false)

  if (status !== 'error') return null

  // the banner stays up when a retry fails, which tells the user something is
  // still wrong but nothing about why, so keep the reason in the log
  const retry = () => {
    setIsRetrying(true)
    manager
      .init()
      .catch((error: unknown) => {
        console.error('retrying the offline database failed', error)
      })
      .finally(() => {
        setIsRetrying(false)
      })
  }

  return (
    <View className="flex-row items-center justify-between gap-3 bg-destructive px-4 py-3">
      <Text className="flex-1 text-sm text-destructive-foreground">
        Offline database unavailable. Your cards are not saved on this device.
      </Text>
      <Button
        label="Retry"
        className="px-3 py-2"
        loading={isRetrying}
        onPress={retry}
      />
    </View>
  )
}
