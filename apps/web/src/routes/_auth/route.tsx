import { RouteErrorComponent } from '@/components/RouteErrorComponent';
import { authClient } from '@/lib/auth-client';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const { data: session, error } = await authClient.getSession();
    if (error) {
      throw error;
    }
    if (session) {
      const onboardingComplete = session.user.onBoardingComplete;
      if (!onboardingComplete) {
        throw redirect({
          to: '/onboarding',
        });
      }
      throw redirect({
        to: '/dashboard',
      });
    }
  },
  errorComponent: RouteErrorComponent,
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen relative bg-surface overflow-hidden">
      {/* Left side - Branding (Hidden on small screens) */}
      <div className="hidden lg:flex flex-col lg:w-[40%] xl:w-[40%] p-12 relative z-10 shrink-0 bg-background border-r border-sage-border rounded-r-2xl shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] overflow-hidden">
        <div className="relative z-10 flex flex-col h-full">
          <a
            href={
              import.meta.env.DEV
                ? 'http://localhost:5173'
                : 'https://notanothercards.com'
            }
            className="flex items-center gap-2 hover:opacity-90 transition-opacity w-fit"
          >
            <img
              src="/brand/notanothercards-logo.svg"
              alt="NotAnotherCards Logo"
              className="h-10 dark:hidden"
            />
            <img
              src="/brand/notanothercards-logo-dark.svg"
              alt="NotAnotherCards Logo"
              className="h-8 hidden dark:block"
            />
          </a>

          <div className="flex-1 flex flex-col justify-center max-w-lg relative z-20">
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-5xl font-bold font-heading text-pine dark:text-white/80 leading-tight">
                {t('auth.layout.title')}
              </h1>
              <p className="text-md text-muted-foreground dark:text-sage/60 leading-relaxed">
                {t('auth.layout.description')}
              </p>
            </div>
          </div>

          {/* Decorative floating cards */}
          <div className="relative h-64 mt-2 w-full pointer-events-none opacity-80 dark:opacity-60 hidden xl:block">
            {/* Background grid pattern for the scene */}
            <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [bg-size:24px_24px] opacity-30" />

            <div className="absolute -top-8 -left-4 -rotate-3 rounded-2xl border border-sage-border bg-surface p-5 shadow-sm w-64">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {t('auth.layout.cards.card1.title')}
              </h3>
              <p className="text-muted-foreground mt-1">
                {t('auth.layout.cards.card1.subtitle')}
              </p>
              <div className="my-4 border-t border-border" />
              <div className="flex gap-2 text-xs font-medium">
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">
                  {t('auth.layout.cards.card1.tag')}
                </span>
              </div>
            </div>

            <div className="absolute top-4 left-32 rotate-6 rounded-2xl border border-sage-border bg-surface p-5 shadow-md w-64 z-10">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {t('auth.layout.cards.card2.title')}
              </h3>
              <p className="text-muted-foreground mt-1">
                {t('auth.layout.cards.card2.subtitle')}
              </p>
              <div className="my-4 border-t border-border" />
              <div className="flex gap-2 text-xs font-medium">
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">
                  {t('auth.layout.cards.card2.tag')}
                </span>
              </div>
            </div>

            <div className="absolute top-20 left-12 -rotate-2 rounded-2xl border border-sage-border bg-surface p-5 shadow-lg w-64 z-20">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {t('auth.layout.cards.card3.title')}
              </h3>
              <p className="text-muted-foreground mt-1">
                {t('auth.layout.cards.card3.subtitle')}
              </p>
              <div className="my-4 border-t border-border" />
              <div className="flex gap-2 text-xs font-medium">
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">
                  {t('auth.layout.cards.card3.tag')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex flex-col flex-1 items-center justify-center p-4 sm:p-8 relative z-10 bg-transparent">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
          <LanguageSwitcher variant="icon" />
        </div>

        {/* Mobile Logo (Visible only on small screens) */}
        <div className="mb-8 lg:hidden">
          <a
            href={
              import.meta.env.DEV
                ? 'http://localhost:5174'
                : 'https://notanothercards.com'
            }
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <img
              src="/brand/notanothercards-logo.svg"
              alt="NotAnotherCards Logo"
              className="h-10 dark:hidden"
            />
            <img
              src="/brand/notanothercards-logo-dark.svg"
              alt="NotAnotherCards Logo"
              className="h-8 hidden dark:block"
            />
          </a>
        </div>

        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300 relative z-20">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
