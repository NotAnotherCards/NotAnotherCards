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

  const onSubmit = (data: SignupFormData) => {
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
        <Button type="submit" className="mt-6">
          Sign up
        </Button>
      </form>
    </div>
  );
}
