import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  supportedLocales,
  localeMetadata,
  isSupportedLocale,
  type SupportedLocale,
} from '@repo/i18n';
import { Segmented } from './ui/segmented';

// Build the option list from centralized metadata so adding a locale only
// requires editing @repo/i18n.
const LOCALE_OPTIONS = supportedLocales.map((locale) => ({
  value: locale,
  label: `${localeMetadata[locale].flag}  ${localeMetadata[locale].nativeName}`,
}));

/**
 * A segmented control that lets the user pick a UI locale.
 * Mirrors the web's LanguageSwitcher with flags and native names.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const resolved = i18n.resolvedLanguage;
  const [locale, setLocale] = useState<SupportedLocale>(
    resolved && isSupportedLocale(resolved) ? resolved : 'en',
  );

  const select = (value: SupportedLocale) => {
    setLocale(value);
    void i18n.changeLanguage(value);
  };

  return (
    <Segmented
      label="Language"
      value={locale}
      options={LOCALE_OPTIONS}
      onChange={select}
    />
  );
}
