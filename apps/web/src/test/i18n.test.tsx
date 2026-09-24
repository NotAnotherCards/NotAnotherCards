import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  supportedLocales,
  localeMetadata,
  isSupportedLocale,
  defaultLocale,
} from '@repo/i18n';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset i18n to English so tests don't leak state into each other. */
async function resetToEnglish() {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
}

// ---------------------------------------------------------------------------
// 1. @repo/i18n package exports
// ---------------------------------------------------------------------------
describe('@repo/i18n package exports', () => {
  it('exports exactly three supported locales', () => {
    expect(supportedLocales).toEqual(['en', 'es', 'de']);
  });

  it('defaults to English', () => {
    expect(defaultLocale).toBe('en');
  });

  it('isSupportedLocale returns true for supported locales and false for others', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('es')).toBe(true);
    expect(isSupportedLocale('de')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('en-US')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });

  it('localeMetadata contains a flag and nativeName for every supported locale', () => {
    for (const locale of supportedLocales) {
      const meta = localeMetadata[locale];
      expect(meta).toBeDefined();
      expect(meta.flag).toBeTruthy();
      expect(meta.nativeName).toBeTruthy();
    }
  });

  it('localeMetadata uses endonyms (native names), not translated names', () => {
    expect(localeMetadata.en.nativeName).toBe('English');
    expect(localeMetadata.es.nativeName).toBe('Español');
    expect(localeMetadata.de.nativeName).toBe('Deutsch');
  });
});

// ---------------------------------------------------------------------------
// 2. i18n adapter (initialization, fallback, html lang sync)
// ---------------------------------------------------------------------------
describe('i18n web adapter', () => {
  beforeEach(async () => {
    await resetToEnglish();
  });

  it('initializes with English as fallback language', () => {
    expect(i18n.options.fallbackLng).toContain('en');
  });

  it('resolves to a supported locale, not a region-qualified tag', async () => {
    // Even if we request 'en-US', resolvedLanguage should collapse to 'en'
    await i18n.changeLanguage('en-US');
    expect(isSupportedLocale(i18n.resolvedLanguage!)).toBe(true);
  });

  it('falls back to English when given an unsupported locale', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.resolvedLanguage).toBe('en');
  });

  it('translates keys in the active language', async () => {
    expect(i18n.t('auth.login.submit')).toBe('Login');

    await act(async () => {
      await i18n.changeLanguage('es');
    });
    expect(i18n.t('auth.login.submit')).toBe('Iniciar sesión');

    await act(async () => {
      await i18n.changeLanguage('de');
    });
    expect(i18n.t('auth.login.submit')).toBe('Anmelden');
  });

  it('updates document.documentElement.lang when the language changes', async () => {
    await i18n.changeLanguage('de');
    expect(document.documentElement.lang).toBe('de');

    await i18n.changeLanguage('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('sets html lang to a supported locale, not a region-qualified tag', async () => {
    await i18n.changeLanguage('es-419');
    // Should resolve to 'es', not 'es-419'
    expect(document.documentElement.lang).toBe('es');
  });
});

// ---------------------------------------------------------------------------
// 3. LanguageSwitcher component
// ---------------------------------------------------------------------------

// Radix Select uses pointer capture and scrollIntoView APIs not available in
// JSDOM. Stub them so Radix event handlers don't throw.
beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

describe('LanguageSwitcher component', () => {
  beforeEach(async () => {
    await resetToEnglish();
  });

  it('renders a select trigger with an accessible aria-label', () => {
    render(<LanguageSwitcher />);
    expect(
      screen.getByRole('combobox', { name: /language/i }),
    ).toBeInTheDocument();
  });

  it('renders all supported locale options when opened (full variant)', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher variant="full" />);

    await user.click(screen.getByRole('combobox'));

    // Each locale name should appear at least once (the selected one appears
    // in both the trigger and the dropdown list)
    for (const locale of supportedLocales) {
      expect(
        screen.getAllByText(localeMetadata[locale].nativeName).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders only flag emojis in the icon variant (no language names)', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher variant="icon" />);

    await user.click(screen.getByRole('combobox'));

    // Flags should be present (may appear in both trigger and dropdown)
    for (const locale of supportedLocales) {
      expect(
        screen.getAllByText(localeMetadata[locale].flag).length,
      ).toBeGreaterThanOrEqual(1);
    }

    // Native names should NOT be rendered anywhere
    for (const locale of supportedLocales) {
      expect(
        screen.queryAllByText(localeMetadata[locale].nativeName),
      ).toHaveLength(0);
    }
  });

  it('reflects a programmatic language change in the component value', async () => {
    // Radix Select option clicks are unreliable in JSDOM, so we test the
    // integration by changing the language through the i18n API and verifying
    // the component re-renders with the new value.
    const { rerender } = render(<LanguageSwitcher variant="full" />);

    await act(async () => {
      await i18n.changeLanguage('de');
    });
    rerender(<LanguageSwitcher variant="full" />);

    // The combobox should now reflect German
    expect(screen.getByRole('combobox')).toHaveTextContent(/Deutsch/);
  });
});
