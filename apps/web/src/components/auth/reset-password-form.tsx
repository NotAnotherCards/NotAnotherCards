import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthCard } from "@/components/auth/auth-card";
import { useState } from "react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { useSearch, Link } from "@tanstack/react-router";
import { passwordSchema } from "@repo/schemas";
import { CheckCircle2 } from "lucide-react";

// Validation schema for step 1: Request reset link (forgotten password)
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// Validation schema for step 2: Reset password with token
const resetPasswordConfirmSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type ResetPasswordConfirmFormData = z.infer<typeof resetPasswordConfirmSchema>;

export function ResetPasswordComponent() {
  const search = useSearch({ from: "/_auth/reset-password" }) as { token?: string };
  const token = search.token;

  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Forms
  const forgotForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const resetConfirmForm = useForm<ResetPasswordConfirmFormData>({
    resolver: zodResolver(resetPasswordConfirmSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = forgotForm.formState.isSubmitting || resetConfirmForm.formState.isSubmitting;

  const handleForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    setApiError(null);
    const { error } = await authClient.requestPasswordReset({
      email: data.email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setApiError(error.message || "An unexpected error occurred");
    } else {
      setSuccess(true);
    }
  };

  const handleResetPasswordConfirmSubmit = async (data: ResetPasswordConfirmFormData) => {
    if (!token) return;
    setApiError(null);
    const { error } = await authClient.resetPassword({
      newPassword: data.password,
      token,
    });

    if (error) {
      setApiError(error.message || "An unexpected error occurred");
    } else {
      setSuccess(true);
    }
  };

  // Success States
  if (success) {
    if (token) {
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
        title="Check your email"
        description="We've sent a password reset link to your email"
        footerText=""
        footerLinkText="Back to login"
        footerLinkTo="/login"
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <p className="text-sm text-muted-foreground">
            Please check your inbox. If the email doesn't arrive in a few minutes, check your spam folder.
          </p>
        </div>
      </AuthCard>
    );
  }

  // Token is present: Reset confirmation form
  if (token) {
    return (
      <AuthCard
        title="Reset Password"
        description="Enter your new password below to complete the reset"
        footerText=""
        footerLinkText="Back to login"
        footerLinkTo="/login"
      >
        <form onSubmit={resetConfirmForm.handleSubmit(handleResetPasswordConfirmSubmit)}>
          <FieldSet>
            <FieldGroup className="gap-4">
              <Controller
                name="password"
                control={resetConfirmForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id={field.name}
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.invalid ? "password-error" : undefined}
                    />
                    <FieldError id="password-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="confirmPassword"
                control={resetConfirmForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <FieldLabel htmlFor={field.name}>Confirm New Password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id={field.name}
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.invalid ? "confirmPassword-error" : undefined}
                    />
                    <FieldError id="confirmPassword-error" errors={[fieldState.error]} />
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
                  "Reset Password"
                )}
              </Button>
            </FieldGroup>
          </FieldSet>
        </form>
      </AuthCard>
    );
  }

  // No token: Request link form
  return (
    <AuthCard
      title="Forgotten Password"
      description="Enter your email below and we will send you a password reset email"
      footerText=""
      footerLinkText="Back to login"
      footerLinkTo="/login"
    >
      <form onSubmit={forgotForm.handleSubmit(handleForgotPasswordSubmit)}>
        <FieldSet>
          <FieldGroup className="gap-4">
            <Controller
              name="email"
              control={forgotForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.invalid ? "email-error" : undefined}
                  />
                  <FieldError id="email-error" errors={[fieldState.error]} />
                </Field>
              )}
            />
            <FormErrorMessage message={apiError} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  Sending email...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>
    </AuthCard>
  );
}
