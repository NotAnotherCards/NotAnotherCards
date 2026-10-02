import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AuthCard } from '@/components/auth/auth-card';
import {
  ForgotPasswordForm,
  ResetEmailSent,
} from '@/components/auth/forgot-password-form';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const search = useLocalSearchParams<{ email?: string | string[] }>();
  const email = Array.isArray(search.email) ? search.email[0] : search.email;

  if (sentTo) {
    return (
      <AuthCard
        title={t('auth.forgot_password.success_title')}
        description={t('auth.forgot_password.success_description')}
        footerText=""
        footerLinkText={t('auth.forgot_password.footerLinkText')}
        footerLinkTo="/login"
      >
        <ResetEmailSent email={sentTo} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('auth.forgot_password.title')}
      description={t('auth.forgot_password.description')}
      footerText=""
      footerLinkText={t('auth.forgot_password.footerLinkText')}
      footerLinkTo="/login"
    >
      <ForgotPasswordForm onSent={setSentTo} defaultEmail={email} />
    </AuthCard>
  );
}
