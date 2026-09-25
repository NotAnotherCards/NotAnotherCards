import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, SignupFormData } from '@repo/schemas';
import { AuthCard } from '@/components/auth/auth-card';
import { authClient } from '@/lib/auth-client';
import { useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { SocialLoginButton } from '@/components/auth/social-login-button';


export function RegisterComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<
    'google' | 'facebook' | null
  >(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      if (errorParam === 'OAuthCallbackError') {
        setApiError(t('auth.error.social_signup_failed_callback'));
      } else {
        setApiError(errorParam.replace(/_/g, ' '));
      }
    }

    const handlePageShow = () => {
      setOauthProvider(null);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setApiError(null);
    setOauthProvider(provider);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}/dashboard`,
        errorCallbackURL: `${window.location.origin}/register`,
      });
      if (error) {
        setApiError(error.message || t('auth.error.social_signup_failed'));
        setOauthProvider(null);
      }
    } catch {
      setOauthProvider(null);
      setApiError(t('auth.error.social_signup_failed'));
    }
  };
  const form = useForm<SignupFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null);
    const { error } = await authClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (error) {
      setApiError(error.message || t('auth.error.unexpected'));
    } else {
      void navigate({ to: '/onboarding' });
    }
  };

  return (
    <AuthCard
      title={t('auth.register.title')}
      description={t('auth.register.description')}
      footerText={t('auth.register.footerText')}
      footerLinkText={t('auth.register.footerLinkText')}
      footerLinkTo="/login"
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup className="gap-3.5">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={field.name}>{t('auth.name')}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? 'name-error' : undefined
                    }
                  />
                  <FieldError id="name-error" errors={[fieldState.error]} />
                </Field>
              )}
            />{' '}
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={field.name}>
                    {t('auth.email')}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? 'email-error' : undefined
                    }
                  />
                  <FieldError id="email-error" errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={field.name}>
                    {t('auth.password')}
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? 'password-error' : undefined
                    }
                  />
                  <FieldError id="password-error" errors={[fieldState.error]} />
                </Field>
              )}
            />{' '}
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={field.name}>
                    {t('auth.confirm_password')}
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? 'confirmPassword-error' : undefined
                    }
                  />
                  <FieldError
                    id="confirmPassword-error"
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
            <FormErrorMessage message={apiError} />
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || oauthProvider !== null}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  {t('auth.register.creating_account')}
                </span>
              ) : (
                t('auth.register.submit')
              )}
            </Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 text-muted-foreground">
                  {t('auth.login.continue_with')}
                </span>
              </div>
            </div>
            <SocialLoginButton
              provider="google"
              isLoading={oauthProvider === 'google'}
              disabled={oauthProvider !== null || isSubmitting}
              onClick={() => handleSocialLogin('google')}
            />
            <SocialLoginButton
              provider="facebook"
              isLoading={oauthProvider === 'facebook'}
              disabled={oauthProvider !== null || isSubmitting}
              onClick={() => handleSocialLogin('facebook')}
            />
          </FieldGroup>
        </FieldSet>
      </form>
    </AuthCard>
  );
}
