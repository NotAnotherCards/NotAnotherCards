import { useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import {
  ForgotPasswordForm,
  ResetEmailSent,
} from '@/components/auth/forgot-password-form';

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <AuthCard
        title="Check your email"
        description="We've sent a password reset link to your email"
        footerText=""
        footerLinkText="Back to login"
        footerLinkTo="/login"
      >
        <ResetEmailSent email={sentTo} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgotten Password"
      description="Enter your email below and we will send you a password reset email"
      footerText=""
      footerLinkText="Back to login"
      footerLinkTo="/login"
    >
      <ForgotPasswordForm onSent={setSentTo} />
    </AuthCard>
  );
}
