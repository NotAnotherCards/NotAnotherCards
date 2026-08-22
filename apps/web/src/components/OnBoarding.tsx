import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDown } from "lucide-react";
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
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import { useStore } from "@/hooks/useStore";
import { authClient } from "@/lib/auth-client";
import { ProfileFormValues, userProfileFormSchema } from "@repo/schemas";
import { LANGUAGES } from "@/lib/languages";

export function OnBoardingComponent() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const { createUserProfile } = useStore();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(userProfileFormSchema),
    defaultValues: {
      username: "",
      native_language_id: "",
      target_language_id: "",
    },
  });

  const nativeLanguage = form.watch("native_language_id");

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: ProfileFormValues) => {
    setApiError(null);
    try {
      const { data: session } = await authClient.getSession();
      if (!session) throw new Error("No active session");
      await createUserProfile({
        id: session.user.id,
        username: data.username,
        native_language_id: data.native_language_id,
        target_language_id: data.target_language_id,
      });
      void navigate({ to: "/app/dashboard" });
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 flex-1">
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
                      value={field.value ?? ""}
                      id={field.name}
                      autoComplete="username"
                      autoFocus
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
                name="native_language_id"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Native Language
                    </FieldLabel>
                    <div className="relative w-full">
                      <select
                        {...field}
                        value={field.value ?? ""}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? "native_language_id-error"
                            : undefined
                        }
                        className="h-9 w-full min-w-0 rounded-3xl border focus-visible:border-ring bg-input/50 pl-3 pr-10 py-1 text-base transition-[color,box-shadow,background-color] outline-none appearance-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm text-foreground cursor-pointer"
                      >
                        <option
                          value=""
                          disabled
                          className="bg-background text-foreground"
                        >
                          Select language
                        </option>
                        {LANGUAGES.map((lang) => (
                          <option
                            key={lang.value}
                            value={lang.value}
                            className="bg-background text-foreground"
                          >
                            {lang.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden="true"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground opacity-60"
                      />
                    </div>
                    <FieldError
                      id="native_language_id-error"
                      errors={[fieldState.error]}
                    />
                  </Field>
                )}
              />

              <Controller
                name="target_language_id"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Target Language
                    </FieldLabel>
                    <div className="relative w-full">
                      <select
                        {...field}
                        value={field.value ?? ""}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? "target_language_id-error"
                            : undefined
                        }
                        className="h-9 w-full min-w-0 rounded-3xl border bg-input/50 pl-3 pr-10 py-1 text-base transition-[color,box-shadow,background-color] outline-none appearance-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm text-foreground cursor-pointer"
                      >
                        <option
                          value=""
                          disabled
                          className="bg-background text-foreground"
                        >
                          Select language
                        </option>
                        {LANGUAGES.filter(
                          (lang) => lang.value !== nativeLanguage,
                        ).map((lang) => (
                          <option
                            key={lang.value}
                            value={lang.value}
                            className="bg-background text-foreground"
                          >
                            {lang.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden="true"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground opacity-60"
                      />
                    </div>
                    <FieldError
                      id="target_language_id-error"
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
                    Saving...
                  </span>
                ) : (
                  "Complete registration"
                )}
              </Button>
            </FieldGroup>
          </FieldSet>
        </form>
      </AuthCard>
    </div>
  );
}
