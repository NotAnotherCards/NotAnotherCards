import { useLocalSearchParams } from 'expo-router';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPassword() {
  const search = useLocalSearchParams<{ email?: string | string[] }>();
  const email = Array.isArray(search.email) ? search.email[0] : search.email;

  return (
    <AuthCard
      title="Create or reset a password"
      description="We'll email you a secure password reset link."
      footerText=""
      footerLinkText="Back to sign in"
      footerLinkTo="/login"
    >
      <ForgotPasswordForm defaultEmail={email} />
    </AuthCard>
  );
}
