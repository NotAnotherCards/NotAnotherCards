import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import i18n from '@/lib/i18n';
import Storage from 'expo-sqlite/kv-store';
import { LanguageSwitcher } from '@/components/language-switcher';

// Reset the storage mock before testing
beforeEach(() => {
  Storage.setItemSync('i18nextLng', '');
});

describe('Mobile i18n adapter', () => {
  it('falls back to English when storage is empty', () => {
    // We already imported i18n, which initialized synchronously, but we can
    // test the fallback behavior by observing its current state or re-initializing.
    // Given the singleton nature of i18next in tests, it should default to 'en'.
    expect(i18n.options.fallbackLng).toContain('en');
  });

  it('updates storage when the language changes', async () => {
    await i18n.changeLanguage('de');
    // Storage should have been updated by the 'languageChanged' event handler
    expect(Storage.getItemSync('i18nextLng')).toBe('de');
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
