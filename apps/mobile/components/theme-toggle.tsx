import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from './ui/text'
import {
  loadThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const [preference, setPreference] = useState(loadThemePreference)

  const select = (value: ThemePreference) => {
    setPreference(value)
    setThemePreference(value)
  }

  return (
    <View className="flex-row rounded-lg bg-muted p-1">
      {OPTIONS.map(({ value, label }) => (
        <Pressable
          key={value}
          onPress={() => select(value)}
          className={`flex-1 items-center rounded-md py-1.5 ${
            value === preference ? 'bg-background' : ''
          }`}
        >
          <Text
            className={
              value === preference
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
