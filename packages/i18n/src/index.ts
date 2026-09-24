import 'i18next';
import en from './catalogs/en.json';
import es from './catalogs/es.json';
import de from './catalogs/de.json';

export const catalogs = {
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
} as const;

export type SupportedLocale = keyof typeof catalogs;
export const supportedLocales = [
  'en',
  'es',
  'de',
] as const satisfies readonly SupportedLocale[];
export const defaultLocale: SupportedLocale = 'en';

export const localeMetadata: Record<
  SupportedLocale,
  { flag: string; nativeName: string }
> = {
  en: { flag: '🇺🇸', nativeName: 'English' },
  es: { flag: '🇪🇸', nativeName: 'Español' },
  de: { flag: '🇩🇪', nativeName: 'Deutsch' },
};

export type I18nKeys = typeof en;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: I18nKeys;
    };
  }
}

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}

export function formatDate(
  date: Date | number,
  locale: SupportedLocale | string = defaultLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatNumber(
  value: number,
  locale: SupportedLocale | string = defaultLocale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercentage(
  value: number,
  locale: SupportedLocale | string = defaultLocale,
): string {
  return new Intl.NumberFormat(locale, { style: 'percent' }).format(value);
}
