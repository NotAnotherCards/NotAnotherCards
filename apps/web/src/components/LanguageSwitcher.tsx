import { useTranslation } from 'react-i18next';
import { supportedLocales, SupportedLocale, localeMetadata } from '@repo/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function LanguageSwitcher({
  variant = 'full',
}: {
  variant?: 'icon' | 'full';
}) {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <Select value={i18n.resolvedLanguage} onValueChange={handleLanguageChange}>
      <SelectTrigger
        aria-label={t('preferences.language')}
        className={
          variant === 'icon'
            ? 'w-fit border-none shadow-none px-2 focus:ring-0'
            : 'w-35'
        }
      >
        <SelectValue placeholder={t('preferences.language')} />
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map((locale: SupportedLocale) => (
          <SelectItem key={locale} value={locale}>
            <span className="flex items-center gap-2">
              <span className="text-base">{localeMetadata[locale].flag}</span>
              {variant === 'full' && <span>{localeMetadata[locale].nativeName}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
