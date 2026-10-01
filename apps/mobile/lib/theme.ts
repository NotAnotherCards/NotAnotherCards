import Storage from 'expo-sqlite/kv-store';
import { colorScheme } from 'nativewind';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'theme-preference';

export function loadThemePreference(): ThemePreference {
  const saved = Storage.getItemSync(KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

export function setThemePreference(preference: ThemePreference) {
  Storage.setItemSync(KEY, preference);
  colorScheme.set(preference);
}

export function applySavedThemePreference() {
  colorScheme.set(loadThemePreference());
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
} as const;

// The native Switch takes color values too, not class names. Android tints
// the track at low alpha, so a light track barely changes between states:
// the thumb carries the state instead, bright when on and dim when off,
// against a track that only sets the tone. Same values as global.css.
export const switchColors = {
  light: {
    trackOn: '#a3a3a3',
    trackOff: '#d4d4d4',
    thumbOn: '#171717',
    thumbOff: '#fafafa',
  },
  dark: {
    trackOn: '#a3a3a3',
    trackOff: '#404040',
    thumbOn: '#fafafa',
    thumbOff: '#737373',
  },
} as const;
