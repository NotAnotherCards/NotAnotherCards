import { useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Text } from '@/components/ui/text';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description="We've sent a password reset link to your email"
        footerText="Done?"
        footerLinkText="Back to login"
        footerLinkTo="/login"
      >
        <Text className="text-center text-muted-foreground">
          Open the link on any device to choose a new password, then log in
          here.
        </Text>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgotten Password"
      description="Enter your email below and we will send you a password reset email"
      footerText="Remembered it?"
      footerLinkText="Back to login"
      footerLinkTo="/login"
    >
      <ForgotPasswordForm onSent={() => setSent(true)} />
    </AuthCard>
  );
}
