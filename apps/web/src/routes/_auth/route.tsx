import { RouteErrorComponent } from '@/components/RouteErrorComponent';
import { authClient } from '@/lib/auth-client';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

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
  return (
    <div className="flex min-h-screen relative bg-sage/5 overflow-hidden">
      {/* Abstract background shapes spanning the entire screen */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-[40%] right-[10%] w-[50%] h-[50%] rounded-full bg-sage/10 blur-3xl" />
        <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-pine/5 blur-3xl" />
      </div>

      {/* Left side - Branding (Hidden on small screens) */}
      <div className="hidden lg:flex flex-col lg:w-[40%] xl:w-[40%] p-12 relative z-10 shrink-0 bg-transparent">

        <div className="relative z-10 flex flex-col h-full">
          <a
            href={
              import.meta.env.DEV
                ? 'http://localhost:5174'
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

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-5xl font-bold font-heading text-pine leading-tight">
                Master any subject with ease.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Not Another Cards uses advanced spaced repetition and AI to help you learn faster and remember longer. Join the community today.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex flex-col flex-1 items-center justify-center p-4 sm:p-8 relative z-10 bg-transparent">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
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

        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
