import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const RESEND_COOLDOWN_SECONDS = 30;

// The email links to the web's reset page, where the token is consumed; the
// reset itself does not happen in the app. The API builds that link from
// its FRONTEND_URL, so there is no redirect target to pass from here.
async function requestReset(email: string) {
  const { error } = await authClient.requestPasswordReset({ email });
  if (error) throw error;
}

export function ForgotPasswordForm({
  onSent,
}: {
  onSent: (email: string) => void;
}) {
  const [apiError, setApiError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setApiError(null);
    try {
      await requestReset(data.email);
      onSent(data.email);
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  };

  return (
    <>
      <FormField
        control={control}
        name="email"
        label="Email"
        placeholder="name@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {apiError && (
        <Text className="text-center text-destructive">{apiError}</Text>
      )}
      <Button
        loading={formState.isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      >
        <Text>Send Reset Link</Text>
      </Button>
    </>
  );
}

// Shown once the email is on its way, as on the web: which inbox to check,
// and a resend that waits out a cooldown so a tap-happy user cannot spam it.
export function ResetEmailSent({ email }: { email: string }) {
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const resend = async () => {
    setResending(true);
    setMessage(null);
    try {
      await requestReset(email);
      setMessage('Password reset email resent successfully!');
      setCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setMessage(apiErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Text className="text-center text-sm text-muted-foreground">
        Please check your inbox for{' '}
        <Text className="font-medium text-foreground">{email}</Text>. If the
        email doesn&apos;t arrive in a few minutes, check your spam folder.
      </Text>
      {message && <Text className="text-center text-sm">{message}</Text>}
      <Button
        variant="outline"
        loading={resending}
        disabled={countdown > 0}
        onPress={() => void resend()}
        className="mt-1"
      >
        <Text>
          {countdown > 0 ? `Resend email in ${countdown}s` : 'Resend email'}
        </Text>
      </Button>
    </>
  );
}
