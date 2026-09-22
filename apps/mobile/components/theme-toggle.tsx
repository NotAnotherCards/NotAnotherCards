import { useState } from 'react';
import { Segmented } from './ui/segmented';
import {
  loadThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme';

// Same order as the web's theme switcher (#95): light, dark, system.
const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function ThemeToggle() {
  const [preference, setPreference] = useState(loadThemePreference);

  const select = (value: ThemePreference) => {
    setPreference(value);
    setThemePreference(value);
  };

  return (
    <Segmented
      label="Theme"
      value={preference}
      options={OPTIONS}
      onChange={select}
    />
  );
}
