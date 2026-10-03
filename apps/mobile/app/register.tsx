import { useTranslation } from 'react-i18next';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { AuthCard } from '@/components/auth/auth-card';
import { SignupForm } from '@/components/auth/signup-form';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isFocused = useIsFocused();

  // Navigate from session state, not from the signUp response: the session
  // store updates a moment after the request resolves, and the dashboard
  // bounces to /login if it mounts before then. Only while this screen is
  // the one showing, as in app/login.tsx.
  useEffect(() => {
    if (isFocused && session)
      router.replace(
        session.user.onBoardingComplete ? '/dashboard' : '/onboarding',
      );
  }, [isFocused, session, router]);

  return (
    <AuthCard
      title={t('auth.register.title')}
      description={t('auth.register.description')}
      footerText={t('auth.register.footerText')}
      footerLinkText={t('auth.login.submit')}
      footerLinkTo="/login"
    >
      <SignupForm />
      {!session ? <LanguageSwitcher /> : null}
    </AuthCard>
  );
}
