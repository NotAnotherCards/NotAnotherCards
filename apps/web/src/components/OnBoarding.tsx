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
import { authClient } from "@/lib/auth-client";
import { useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import z from "zod";

export const userSettingsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores",
    ),
  nativeLanguage: z.string().min(1, "Native language is required"),
  preferedLanguage: z.string().min(1, "Preferred language is required"),
});
export type UserSettingsFormData = z.infer<typeof userSettingsSchema>;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "ru", label: "Russian" },
];

export function OnBoardingComponent() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<UserSettingsFormData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      username: "",
      nativeLanguage: "",
      preferedLanguage: "",
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: UserSettingsFormData) => {
    setApiError(null);
    const { data: res, error } = await authClient.updateUser({
      username: data.username,
    });

    if (error) {
      setApiError(error.message || "An unexpected error occurred");
    } else {
      localStorage.setItem("nativeLanguage", data.nativeLanguage);
      localStorage.setItem("preferedLanguage", data.preferedLanguage);
      navigate({ to: "/app/dashboard" });
      console.log("Onboarded successfully:", res);
    }
  };

  return (
    <AuthCard
      title="Welcome!"
      description="Choose your username and language preferences to get started"
      footerText=""
      footerLinkText=""
      footerLinkTo=""
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup className="gap-4">
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
                  <FieldError id="username-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="nativeLanguage"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Native Language</FieldLabel>
                  <select
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    className="h-9 w-full min-w-0 rounded-3xl border border-transparent px-3 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm text-foreground bg-neutral-900 dark:bg-neutral-800"
                  >
                    <option value="" disabled>Select language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <FieldError id="nativeLanguage-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="preferedLanguage"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Preferred Language</FieldLabel>
                  <select
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    className="h-9 w-full min-w-0 rounded-3xl border border-transparent px-3 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm text-foreground bg-neutral-900 dark:bg-neutral-800"
                  >
                    <option value="" disabled>Select language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <FieldError id="preferedLanguage-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <FormErrorMessage message={apiError} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  Saving...
                </span>
              ) : (
                "Complete userSettings"
              )}
            </Button>
            
            <div className="flex flex-col items-center gap-2 mt-4 text-xs text-muted-foreground">
              <div className="flex gap-4">
                <Link to="/login" className="hover:text-foreground hover:underline">
                  Back to Login
                </Link>
                <span>|</span>
                <Link to="/register" className="hover:text-foreground hover:underline">
                  Back to Sign Up
                </Link>
                <span>|</span>
                <Link to="/" className="hover:text-foreground hover:underline">
                  Go to Home
                </Link>
              </div>
            </div>
          </FieldGroup>
        </FieldSet>
      </form>
    </AuthCard>
  );
}
