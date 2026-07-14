import { createFileRoute } from "@tanstack/react-router";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, SignupFormData } from "@repo/schemas";

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
    <div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldLegend>Create Account</FieldLegend>
          <FieldGroup>
            <Controller
              name="firstName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                  <Input
                    {...field}
                    id="firstName"
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
                <Field>
                  <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                  <Input
                    {...field}
                    id="lastName"
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
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="email"
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
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    {...field}
                    id="password"
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
                <Field>
                  <FieldLabel htmlFor="confirmPassword">
                    Confirm Password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="confirmPassword"
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
          </FieldGroup>
        </FieldSet>
        <Button type="submit" className="mt-6 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating account...
            </span>
          ) : (
            "Sign up"
          )}
        </Button>
      </form>
    </div>
  );
}
