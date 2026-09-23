import { SupportedLocale, defaultLocale } from './index';

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
