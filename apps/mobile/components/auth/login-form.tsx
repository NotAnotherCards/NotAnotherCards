import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@repo/schemas';
import { authClient } from '@/lib/auth-client';
import { useSignOutBarrier } from '@/lib/sync-sign-out';
import { toUiError, UiError, uiErrorText } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import {
  beginTwoFactorChallenge,
  finishTwoFactorChallenge,
  isTwoFactorRedirect,
} from '@/lib/two-factor-challenge';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';

export function LoginForm() {
  const { t } = useTranslation();
  const { signingOut, waitForSignOut } = useSignOutBarrier();
  const router = useRouter();
  const [apiError, setApiError] = useState<UiError | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { isSubmitting } = formState;

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);
    if (!(await waitForSignOut())) return;

    await finishTwoFactorChallenge();
    try {
      const { data: response, error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });
      if (error) {
        setApiError(toUiError(error));
      } else if (isTwoFactorRedirect(response)) {
        await beginTwoFactorChallenge();
        router.replace('/two-factor');
      }
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
      <FormField
        control={control}
        name="password"
        label={t('auth.password')}
        placeholder={t('auth.password')}
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
          {signingOut ? t('auth.signing_out') : t('auth.login.submit')}
        </Text>
      </Button>
      <SocialLoginButtons />
      <Text className="mt-1 text-center text-muted-foreground">
        {t('auth.login.forgot_password')}{' '}
        <Link href="/forgot-password" asChild>
          <Text className="font-semibold text-foreground">
            {t('auth.login.reset_here')}
          </Text>
        </Link>
      </Text>
    </>
  );
}
