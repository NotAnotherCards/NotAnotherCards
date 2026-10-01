import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Storage from 'expo-sqlite/kv-store';
import {
  catalogs,
  defaultLocale,
  supportedLocales,
  isSupportedLocale,
} from '@repo/i18n';

import * as Localization from 'expo-localization';

const STORAGE_KEY = 'i18nextLng';

/**
 * Read the saved locale from SQLite KV storage. Falls back to the device
 * locale on first launch, or the default locale if unsupported.
 */
function loadSavedLocale(): string | undefined {
  const saved = Storage.getItemSync(STORAGE_KEY);
  if (saved && isSupportedLocale(saved)) return saved;

  const deviceLocales = Localization.getLocales();
  if (deviceLocales.length > 0) {
    const langCode = deviceLocales[0].languageCode;
    if (langCode && isSupportedLocale(langCode)) {
      return langCode;
    }
  }

  return undefined;
}

// Initialize i18next synchronously with bundled catalogs. The resources are
// shipped in the JS bundle so init() resolves immediately.
void i18n.use(initReactI18next).init({
  resources: catalogs,
  lng: loadSavedLocale(),
  fallbackLng: defaultLocale,
  supportedLngs: [...supportedLocales],
  showSupportNotice: false, // Suppress the Locize promotional banner in console

  interpolation: {
    escapeValue: false, // React Native handles escaping
  },
});

export default i18n;
