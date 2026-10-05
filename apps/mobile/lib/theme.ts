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
// values as global.css. The screens' ground is the surface tone in both
// modes, so the cards and header stand off it.
export const navigationColors = {
  light: {
    background: '#ffffff',
    surface: '#f2f6f2',
    foreground: '#18181b',
    card: '#ffffff',
    border: '#e4e4e7',
  },
  dark: {
    background: '#18181b',
    surface: '#202023',
    foreground: '#fafafa',
    card: '#18181b',
    border: '#3f3f46',
  },
} as const;

// Web's --shadow-card. NativeWind's shadow utilities become an Android
// elevation, which cannot carry this offset and blur, so the card sets
// React Native's boxShadow itself.
export const cardShadows = {
  light: '0 12px 30px rgba(24, 24, 27, 0.08)',
  dark: '0 12px 30px rgba(0, 0, 0, 0.25)',
} as const;

// The native Switch takes color values too, not class names. Android tints
// the track at low alpha, so a light track barely changes between states:
// the thumb carries the state instead, bright when on and dim when off,
// against a track that only sets the tone. These use sage, border, primary,
// and card from global.css, respectively.
export const switchColors = {
  light: {
    trackOn: '#dde9e0',
    trackOff: '#e4e4e7',
    thumbOn: '#5865b5',
    thumbOff: '#ffffff',
  },
  dark: {
    trackOn: '#a6bbb0',
    trackOff: '#3f3f46',
    thumbOn: '#9da8ec',
    thumbOff: '#18181b',
  },
} as const;
