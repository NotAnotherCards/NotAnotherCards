import Storage from 'expo-sqlite/kv-store'
import { colorScheme } from 'nativewind'

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'theme-preference'

export function loadThemePreference(): ThemePreference {
  const saved = Storage.getItemSync(KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function setThemePreference(preference: ThemePreference) {
  Storage.setItemSync(KEY, preference)
  colorScheme.set(preference)
}

export function applySavedThemePreference() {
  colorScheme.set(loadThemePreference())
}

// Native navigation (headers) takes color values, not class names. Same
// values as global.css; the header uses the card tone so it stands off the
// body in dark mode.
export const navigationColors = {
  light: {
    background: '#ffffff',
    foreground: '#0a0a0a',
    card: '#ffffff',
    border: '#e5e5e5',
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#fafafa',
    card: '#171717',
    border: '#ffffff1a',
  },
} as const

