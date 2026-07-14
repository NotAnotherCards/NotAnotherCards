import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { LoginFormData, loginSchema } from "@repo/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/_auth/login")({
  component: LoginComponent,
});

function LoginComponent() {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema as any),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: LoginFormData) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(data);
  };

  return (
    <AuthCard
      title="Welcome Back"
      description="Enter your email below to log in to your account"
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerLinkTo="/register"
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "email-error" : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError id="email-error" errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="password"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "password-error" : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id="password-error"
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-current"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>
    </AuthCard>
  );
}
