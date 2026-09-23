import en from './catalogs/en.json';
import es from './catalogs/es.json';
import de from './catalogs/de.json';

export const catalogs = {
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
} as const;

export type SupportedLocale = keyof typeof catalogs;
export const supportedLocales: SupportedLocale[] = ['en', 'es', 'de'];
export const defaultLocale: SupportedLocale = 'en';

export type I18nKeys = typeof en;

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}
