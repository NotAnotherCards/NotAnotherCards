import { createFileRoute } from "@tanstack/react-router";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, SignupFormData } from "@repo/schemas";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/_auth/register")({
  component: RegisterComponent,
});

function RegisterComponent() {
  const form = useForm<SignupFormData>({
    resolver: zodResolver(registerSchema as any),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: SignupFormData) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(data);
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
              name="firstName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>First Name</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "firstName-error" : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id="firstName-error"
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />{" "}
            <Controller
              name="lastName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Last Name</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "lastName-error" : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id="lastName-error"
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />{" "}
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
            />{" "}
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Confirm Password</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="password"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "confirmPassword-error" : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id="confirmPassword-error"
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner/>
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
