import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type SignupFormData } from '@repo/schemas';
import { authClient } from '@/lib/auth-client';
import { useSignOutBarrier } from '@/lib/sync-sign-out';
import { toUiError, UiError, uiErrorText } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';

// Hermes' Intl support is partial; if timezone detection fails the field
// stays unset and the server defaults to UTC.
function getTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function SignupForm() {
  const { t } = useTranslation();
  const { signingOut, waitForSignOut } = useSignOutBarrier();
  const [apiError, setApiError] = useState<UiError | null>(null);
  const { control, handleSubmit, formState } = useForm<SignupFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
  const { isSubmitting } = formState;

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null);
    if (!(await waitForSignOut())) return;
    try {
      const { error } = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        timezone: getTimezone(),
      });
      if (error) {
        setApiError(toUiError(error));
      }
    } catch (err) {
      setApiError(toUiError(err));
    }
  };

  return (
    <>
      <FormField
        control={control}
        name="name"
        label={t('auth.name')}
        placeholder={t('auth.name')}
        autoCapitalize="words"
      />
      <FormField
        control={control}
        name="email"
        label={t('auth.email')}
        placeholder={t('auth.email_placeholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <FormField
        control={control}
        name="password"
        label={t('auth.password')}
        placeholder={t('auth.password')}
        secureTextEntry
        autoCapitalize="none"
      />
      <FormField
        control={control}
        name="confirmPassword"
        label={t('auth.confirm_password')}
        placeholder={t('auth.confirm_password')}
        secureTextEntry
        autoCapitalize="none"
      />

      {apiError && (
        <Text className="text-center text-destructive">
          {uiErrorText(apiError, t)}
        </Text>
      )}

      <Button
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      >
        <Text>
          {signingOut ? t('auth.signing_out') : t('auth.register.submit')}
        </Text>
      </Button>

      <SocialLoginButtons />
    </>
  );
}
