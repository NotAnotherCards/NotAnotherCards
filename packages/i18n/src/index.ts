import en from './catalogs/en.json';
import es from './catalogs/es.json';
import de from './catalogs/de.json';

export * from './formatters';

export const catalogs = {
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
} as const;

export type SupportedLocale = keyof typeof catalogs;
export const supportedLocales = ['en', 'es', 'de'] as const satisfies readonly SupportedLocale[];
export const defaultLocale: SupportedLocale = 'en';

export const localeMetadata: Record<SupportedLocale, { flag: string; nativeName: string }> = {
  en: { flag: '🇺🇸', nativeName: 'English' },
  es: { flag: '🇪🇸', nativeName: 'Español' },
  de: { flag: '🇩🇪', nativeName: 'Deutsch' },
};

export type I18nKeys = typeof en;

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}

