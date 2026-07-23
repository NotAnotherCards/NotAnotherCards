import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, SignupFormData } from "@repo/schemas";
import { AuthCard } from "@/components/auth/auth-card";
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormErrorMessage } from "@/components/auth/form-error-message";

export function RegisterComponent() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<SignupFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null);
    const { data: res, error } = await authClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      username: data.username,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (error) {
      setApiError(error.message || "An unexpected error occurred");
      console.error(error.message);
    } else {
      navigate({ to: "/app/dashboard" });
      console.log("Registered:", res);
    }
  };

  return (
    <AuthCard
      title="Create Account"
      description="Enter your details to create a new profile"
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkTo="/login"
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "name-error" : undefined
                    }
                  />
                  <FieldError id="name-error" errors={[fieldState.error]} />
                </Field>
              )}
            />{" "}
            <Controller
              name="username"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    autoComplete="username"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "username-error" : undefined
                    }
                  />
                  <FieldError
                    id="username-error"
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "email-error" : undefined
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
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "password-error" : undefined
                    }
                  />
                  <FieldError id="password-error" errors={[fieldState.error]} />
                </Field>
              )}
            />{" "}
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Confirm Password</FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "confirmPassword-error" : undefined
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
                  Creating account...
                </span>
              ) : (
                "Sign up"
              )}
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>
    </AuthCard>
  );
}
