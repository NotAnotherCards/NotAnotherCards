import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import i18n from '@/lib/i18n';
import Storage from 'expo-sqlite/kv-store';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LanguageField } from '@/components/language-field';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', languageTag: 'en-US' }]),
}));

// Reset the storage mock before testing
beforeEach(async () => {
  Storage.setItemSync('i18nextLng', '');
  await i18n.changeLanguage('en');
});

describe('Mobile i18n adapter', () => {
  it('falls back to English when storage is empty and device locale is unsupported', () => {
    let freshI18n!: typeof i18n;
    jest.isolateModules(() => {
      const Loc = require('expo-localization');
      Loc.getLocales.mockReturnValue([
        { languageCode: 'it', languageTag: 'it-IT' },
      ]);
      freshI18n = require('@/lib/i18n').default;
    });
    expect(freshI18n.options.fallbackLng).toContain('en');
  });

  it('uses supported device locale on first launch if storage is empty', () => {
    let freshI18n!: typeof i18n;
    jest.isolateModules(() => {
      const Loc = require('expo-localization');
      Loc.getLocales.mockReturnValue([
        { languageCode: 'es', languageTag: 'es-ES' },
      ]);
      freshI18n = require('@/lib/i18n').default;
    });
    expect(freshI18n.options.lng).toBe('es');
  });
});

describe('LanguageSwitcher', () => {
  it('renders the language options and switches language on press', async () => {
    await i18n.changeLanguage('en');

    const { getByText, getByLabelText } = render(<LanguageSwitcher />);

    // The switcher should be rendered
    expect(getByLabelText('Language')).toBeTruthy();

    // English should be selected (bolded)
    const englishOption = getByText(/English/);
    expect(englishOption.props.className).toContain('font-semibold');

    // German should not be selected
    const germanOption = getByText(/Deutsch/);
    expect(germanOption.props.className).toContain('text-muted-foreground');

    // Press the German option
    fireEvent.press(germanOption);

    // i18next language should update
    expect(i18n.resolvedLanguage).toBe('de');

    // And storage should be updated
    expect(Storage.getItemSync('i18nextLng')).toBe('de');
  });
});

describe('LanguageField', () => {
  it('uses the interface language for language names and accessibility labels', async () => {
    await i18n.changeLanguage('de');

    const { getByText, getByLabelText } = render(
      <LanguageField label="Native language" value="" onChange={jest.fn()} />,
    );

    expect(getByText('🇺🇸 Englisch')).toBeTruthy();
    expect(getByText('🇩🇪 Deutsch')).toBeTruthy();
    expect(getByText('🇷🇺 Russisch')).toBeTruthy();
    expect(getByLabelText('Native language: 🇩🇪 Deutsch')).toBeTruthy();
  });
});
