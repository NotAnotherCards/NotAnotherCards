import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { catalogs, type SupportedLocale } from '@repo/i18n';

// A fresh instance keeps locale changes from leaking between tests.
export async function renderWithLocale(
  ui: ReactElement,
  locale: SupportedLocale,
) {
  const i18n = createInstance();
  await i18n.init({
    resources: catalogs,
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    showSupportNotice: false,
  });
  return {
    ...render(ui, {
      wrapper: ({ children }) => (
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      ),
    }),
    i18n,
  };
}
