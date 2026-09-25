import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthCard } from '@/components/auth/auth-card';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { useSearch, Link } from '@tanstack/react-router';
import { passwordSchema } from '@repo/schemas';
import { CheckCircle2 } from 'lucide-react';


const resetPasswordConfirmSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, 'auth.validation.confirm_password_required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.validation.passwords_mismatch',
    path: ['confirmPassword'],
  });
export type ResetPasswordConfirmFormData = z.infer<
  typeof resetPasswordConfirmSchema
>;

export function ResetPasswordComponent() {
  const { t } = useTranslation();
  const search = useSearch({ from: '/_auth/reset-password' }) as {
    token?: string;
  };
  const token = search.token;

  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ResetPasswordConfirmFormData>({
    resolver: zodResolver(resetPasswordConfirmSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: ResetPasswordConfirmFormData) => {
    if (!token) {
      setApiError(t('auth.error.reset_token_missing'));
      return;
    }
    setApiError(null);
    const { error } = await authClient.resetPassword({
      newPassword: data.password,
      token,
    });

    if (error) {
      setApiError(error.message || t('auth.error.unexpected'));
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <AuthCard
        title={t('auth.reset_password.success_title')}
        description={t('auth.reset_password.success_description')}
        footerText=""
        footerLinkText={t('auth.forgot_password.footerLinkText')}
        footerLinkTo="/login"
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('auth.reset_password.can_log_in')}
          </p>
          <Button asChild className="w-full mt-4">
            <Link to="/login">{t('auth.reset_password.go_to_login')}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('auth.reset_password.title')}
      description={t('auth.reset_password.description')}
      footerText=""
      footerLinkText={t('auth.forgot_password.footerLinkText')}
      footerLinkTo="/login"
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup className="gap-4">
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={field.name}>
                    {t('auth.reset_password.new_password')}
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? 'password-error' : undefined
                    }
                  />
                  <FieldError id="password-error" errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={field.name}>
                    {t('auth.reset_password.confirm_new_password')}
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    autoComplete="new-password"
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  {t('auth.reset_password.updating_password')}
                </span>
              ) : (
                t('auth.reset_password.submit')
              )}
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>
    </AuthCard>
  );
}
