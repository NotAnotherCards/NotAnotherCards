import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Controller, useForm } from 'react-hook-form';
import { LoginFormData, loginSchema } from '@repo/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthCard } from '@/components/auth/auth-card';
import { authClient } from '@/lib/auth-client';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { SocialLoginButton } from '@/components/auth/social-login-button';
import {
  isTwoFactorRedirect,
  rememberPendingChallenge,
  safeReturnTo,
} from '@/lib/two-factor-challenge';

export function LoginComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: '/_auth/login' });
  const returnTo = safeReturnTo(search.redirect);
  const [apiError, setApiError] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<
    'google' | 'facebook' | null
  >(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      if (errorParam === 'OAuthCallbackError') {
        setApiError(t('auth.error.social_login_failed_callback'));
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
        callbackURL: `${window.location.origin}${returnTo}`,
        errorCallbackURL: `${window.location.origin}/login?redirect=${encodeURIComponent(returnTo)}`,
      });

      if (error) {
        setApiError(error.message || t('auth.error.social_login_failed'));
        setOauthProvider(null);
      }
    } catch {
      setOauthProvider(null);
      setApiError(t('auth.error.social_login_failed'));
    }
  };

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);
    const { data: response, error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setApiError(error.message || t('auth.error.unexpected'));
    } else if (isTwoFactorRedirect(response)) {
      rememberPendingChallenge(returnTo);
      void navigate({
        to: '/two-factor',
        search: { redirect: returnTo },
      });
    } else {
      void navigate({ href: returnTo });
    }
  };

  return (
    <AuthCard
      title={t('auth.login.title')}
      description={t('auth.login.description')}
      footerText=""
      footerLinkText=""
      footerLinkTo=""
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup className="gap-4">
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
                  {t('auth.login.logging_in')}
                </span>
              ) : (
                t('auth.login.submit')
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
      <div className="flex flex-col items-center justify-center gap-2 border-t border-border/10 pt-3.5 pb-2 text-center">
        <p className="text-xs text-muted-foreground">
          {t('auth.login.forgot_password')}{' '}
          <Link
            to="/forgot-password"
            className="text-primary font-medium hover:underline transition-colors"
          >
            {t('auth.login.reset_here')}
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          {t('auth.login.no_account')}{' '}
          <Link
            to="/register"
            className="text-primary font-medium hover:underline transition-colors"
          >
            {t('auth.login.sign_up')}
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
