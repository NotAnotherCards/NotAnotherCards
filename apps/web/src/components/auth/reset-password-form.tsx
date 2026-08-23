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
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { useSearch, Link } from '@tanstack/react-router';
import { passwordSchema } from '@repo/schemas';
import { CheckCircle2 } from 'lucide-react';

const resetPasswordConfirmSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordConfirmFormData = z.infer<
  typeof resetPasswordConfirmSchema
>;

export function ResetPasswordComponent() {
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
      setApiError('Reset token is missing or invalid.');
      return;
    }
    setApiError(null);
    const { error } = await authClient.resetPassword({
      newPassword: data.password,
      token,
    });

    if (error) {
      setApiError(error.message || 'An unexpected error occurred');
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <AuthCard
        title="Password Reset"
        description="Your password has been successfully updated"
        footerText=""
        footerLinkText="Back to login"
        footerLinkTo="/login"
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <p className="text-sm text-muted-foreground">
            You can now log in to your account with your new password.
          </p>
          <Button asChild className="w-full mt-4">
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset Password"
      description="Enter your new password below to complete the reset"
      footerText=""
      footerLinkText="Back to login"
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
                  <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
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
                    Confirm New Password
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
                  Updating password...
                </span>
              ) : (
                'Reset Password'
              )}
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>
    </AuthCard>
  );
}
