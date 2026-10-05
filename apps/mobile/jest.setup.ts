import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { catalogs } from '@repo/i18n';

// Real bundled text, as at app startup. Locale-specific tests use their own
// provider so changing language in one test cannot leak into another.
void i18n.use(initReactI18next).init({
  resources: catalogs,
  lng: 'en',
  fallbackLng: 'en',
  showSupportNotice: false,
  interpolation: { escapeValue: false },
});

// Reanimated and its worklets runtime need native code; tests use their JS
// mocks.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);
// The mock lacks useReducedMotion; tests run with motion on.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
