import { useTranslation } from 'react-i18next';
import {
  supportedLocales,
  localeMetadata,
  isSupportedLocale,
  type SupportedLocale,
} from '@repo/i18n';
import { Segmented } from './ui/segmented';
import { Text } from './ui/text';
import Storage from 'expo-sqlite/kv-store';

// Build the option list from centralized metadata so adding a locale only
// requires editing @repo/i18n.
const LOCALE_OPTIONS = supportedLocales.map((locale) => ({
  value: locale,
  label: localeMetadata[locale].nativeName,
}));

/**
 * A segmented control that lets the user pick a UI locale.
 * Mirrors the web's LanguageSwitcher with flags and native names.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const resolved = i18n.resolvedLanguage;
  const locale = resolved && isSupportedLocale(resolved) ? resolved : 'en';

  const select = (value: SupportedLocale) => {
    void i18n.changeLanguage(value);
    Storage.setItemSync('i18nextLng', value);
  };

  return (
    <Segmented
      label={t('preferences.language')}
      value={locale}
      options={LOCALE_OPTIONS}
      onChange={select}
      stacked
      renderIcon={(value) => <Text>{localeMetadata[value].flag}</Text>}
    />
  );
}
