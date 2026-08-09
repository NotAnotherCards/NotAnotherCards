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
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import z from "zod";

// TODO: user setting schema will be imported from @repo/schemas
export const userSettingsSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(
        /^[A-Za-z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores",
      ),
    nativeLanguage: z.enum(["en", "es", "de", "ru"], {
      message: "Native language is required",
    }),
    preferedLanguage: z.enum(["en", "es", "de", "ru"], {
      message: "Preferred language is required",
    }),
  })
  .refine((data) => data.nativeLanguage !== data.preferedLanguage, {
    message: "Preferred language cannot be the same as native language",
    path: ["preferedLanguage"],
  });

export type UserSettingsFormData = z.infer<typeof userSettingsSchema>;

export type SupportedLanguage = "en" | "es" | "de" | "ru";

export const LANGUAGES = [
  { value: "en", label: "🇺🇸 English" },
  { value: "es", label: "🇪🇸 Spanish" },
  { value: "de", label: "🇩🇪 German" },
  { value: "ru", label: "🇷🇺 Russian" },
];

export function OnBoardingComponent() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<UserSettingsFormData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      username: "",
      nativeLanguage: "" as unknown as SupportedLanguage,
      preferedLanguage: "" as unknown as SupportedLanguage,
    },
  });

  const nativeLanguage = form.watch("nativeLanguage");

  const { isSubmitting } = form.formState;

  // TODO: save langauges properly in db after backend is handled
  const onSubmit = async (data: UserSettingsFormData) => {
    setApiError(null);
    const { error } = await authClient.updateUser({
      username: data.username,
    });

    if (error) {
      setApiError(error.message || "An unexpected error occurred");
    } else {
      navigate({ to: "/app/dashboard" });
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
                name="nativeLanguage"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Native Language
                    </FieldLabel>
                    <div className="relative w-full">
                      <select
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? "nativeLanguage-error"
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
                      id="nativeLanguage-error"
                      errors={[fieldState.error]}
                    />
                  </Field>
                )}
              />

              <Controller
                name="preferedLanguage"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Preferred Language
                    </FieldLabel>
                    <div className="relative w-full">
                      <select
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? "preferedLanguage-error"
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
                      id="preferedLanguage-error"
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
