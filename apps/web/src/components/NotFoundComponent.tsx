import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';

export function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground text-center">
      <h1 className="text-4xl font-extrabold mb-2 tracking-tight">404</h1>
      <p className="text-muted-foreground mb-6">{t('not_found.message')}</p>
      <Link
        to="/"
        className="px-4 py-2 rounded-3xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
      >
        {t('not_found.go_home')}
      </Link>
    </div>
  );
}
