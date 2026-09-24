import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { catalogs, defaultLocale, supportedLocales } from '@repo/i18n';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: catalogs,
    fallbackLng: defaultLocale,
    supportedLngs: supportedLocales,
    showSupportNotice: false,

    interpolation: {
      escapeValue: false, // not needed for react
    },

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: [],
    },
  });

// Update the html lang attribute when the language changes
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = i18n.resolvedLanguage ?? lng;
});

// Set the initial lang attribute based on the detected language
if (i18n.language) {
  document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language;
}

export default i18n;
