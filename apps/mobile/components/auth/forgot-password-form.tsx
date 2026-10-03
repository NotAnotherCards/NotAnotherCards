import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { toUiError, UiError, uiErrorText } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';

const forgotPasswordSchema = z.object({
  email: z.string().email('auth.validation.invalid_email'),
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
  defaultEmail = '',
}: {
  onSent: (email: string) => void;
  defaultEmail?: string;
}) {
  const { t } = useTranslation();
  const [apiError, setApiError] = useState<UiError | null>(null);
  const { control, handleSubmit, formState } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setApiError(null);
    try {
      await requestReset(data.email);
      onSent(data.email);
    } catch (err) {
      setApiError(toUiError(err));
    }
  };

  return (
    <>
      <FormField
        control={control}
        name="email"
        label={t('auth.email')}
        placeholder={t('auth.email_placeholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {apiError && (
        <Text className="text-center text-destructive">
          {uiErrorText(apiError, t)}
        </Text>
      )}
      <Button
        loading={formState.isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      >
        <Text>{t('auth.forgot_password.submit')}</Text>
      </Button>
    </>
  );
}

// Shown once the email is on its way, as on the web: which inbox to check,
// and a resend that waits out a cooldown so a tap-happy user cannot spam it.
export function ResetEmailSent({ email }: { email: string }) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<UiError | null>(null);

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
      setMessage(new UiError('auth.forgot_password.resend_success'));
      setCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setMessage(toUiError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Text className="text-center text-sm text-muted-foreground">
        {t('auth.forgot_password.check_inbox_1')}{' '}
        <Text className="font-medium text-foreground">{email}</Text>
        {t('auth.forgot_password.check_inbox_2')}
      </Text>
      {message && (
        <Text className="text-center text-sm">{uiErrorText(message, t)}</Text>
      )}
      <Button
        variant="outline"
        loading={resending}
        disabled={countdown > 0}
        onPress={() => void resend()}
        className="mt-1"
      >
        <Text>
          {countdown > 0
            ? t('auth.forgot_password.resend_in', { countdown })
            : t('auth.forgot_password.resend')}
        </Text>
      </Button>
    </>
  );
}
