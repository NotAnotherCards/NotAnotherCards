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
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthCard } from "@/components/auth/auth-card";
import { useState, useEffect } from "react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { CheckCircle2 } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordComponent() {
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (success && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [success, countdown]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setApiError(null);
    const { error } = await authClient.requestPasswordReset({
      email: data.email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setApiError(error.message || "An unexpected error occurred");
    } else {
      setSuccess(true);
      setCountdown(30);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setResendMessage(null);

    const email = form.getValues("email");
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsResending(false);

    if (error) {
      setResendMessage(error.message || "Failed to resend email");
    } else {
      setResendMessage("Password reset email resent successfully!");
      setCountdown(30);
    }
  };

  if (success) {
    return (
      <AuthCard
        title="Check your email"
        description="We've sent a password reset link to your email"
        footerText=""
        footerLinkText="Back to login"
        footerLinkTo="/login"
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center animate-in fade-in zoom-in duration-300">
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <p className="text-sm text-muted-foreground">
            Please check your inbox for <span className="font-medium text-foreground">{form.getValues("email")}</span>. If the email doesn't arrive in a few minutes, check your spam folder.
          </p>

          {resendMessage && (
            <p className="text-xs text-emerald-500 font-medium">
              {resendMessage}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={countdown > 0 || isResending}
            className="w-full mt-2"
          >
            {isResending ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Resending...
              </span>
            ) : countdown > 0 ? (
              `Resend email in ${countdown}s`
            ) : (
              "Resend email"
            )}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgotten Password"
      description="Enter your email below and we will send you a password reset email"
      footerText=""
      footerLinkText="Back to login"
      footerLinkTo="/login"
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup className="gap-4">
            <Controller
              name="email"
              control={form.control}
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
