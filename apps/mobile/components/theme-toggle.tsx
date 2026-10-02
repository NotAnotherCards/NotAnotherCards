import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from './ui/segmented';
import {
  loadThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme';

export function ThemeToggle() {
  const { t } = useTranslation();
  const options: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: t('mobile.theme.light') },
    { value: 'dark', label: t('mobile.theme.dark') },
    { value: 'system', label: t('mobile.theme.system') },
  ];
  const [preference, setPreference] = useState(loadThemePreference);

  const select = (value: ThemePreference) => {
    setPreference(value);
    setThemePreference(value);
  };

  return (
    <Segmented
      label={t('dashboard.settings.preferences.theme')}
      value={preference}
      options={options}
      onChange={select}
    />
  );
}
