import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Storage from 'expo-sqlite/kv-store';
import {
  catalogs,
  defaultLocale,
  supportedLocales,
  isSupportedLocale,
} from '@repo/i18n';

const STORAGE_KEY = 'i18nextLng';

/**
 * Read the saved locale from SQLite KV storage. Falls back to the default
 * locale if the saved value is missing, empty, or unsupported.
 */
function loadSavedLocale(): string | undefined {
  const saved = Storage.getItemSync(STORAGE_KEY);
  if (saved && isSupportedLocale(saved)) return saved;
  return undefined;
}

/**
 * Persist the resolved locale so it survives app restarts.
 * Called on every language change.
 */
function persistLocale(lng: string) {
  Storage.setItemSync(STORAGE_KEY, lng);
}

// Initialize i18next synchronously with bundled catalogs. The resources are
// shipped in the JS bundle so init() resolves immediately.
void i18n.use(initReactI18next).init({
  resources: catalogs,
  lng: loadSavedLocale(),
  fallbackLng: defaultLocale,
  supportedLngs: [...supportedLocales],

  interpolation: {
    escapeValue: false, // React Native handles escaping
  },
});

// Persist every language change so the choice survives restarts.
i18n.on('languageChanged', (lng) => {
  const resolved = i18n.resolvedLanguage ?? lng;
  persistLocale(resolved);
});

export default i18n;
