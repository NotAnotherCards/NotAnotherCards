import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { ChevronDown, User, Globe, Save, Check } from "lucide-react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import { LANGUAGES, SupportedLanguage, UserSettingsFormData, userSettingsSchema } from "../OnBoarding";

// TODO: schemas will be imported from @repo/schemas
export function Settings() {
  const { data: session, refetch } = authClient.useSession();
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<UserSettingsFormData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      username: "",
      nativeLanguage: "" as unknown as SupportedLanguage,
      preferedLanguage: "" as unknown as SupportedLanguage,
    },
  });

  const { isSubmitting } = form.formState;

  // TODO: handle laguage updates and sync properly

  // Sync form values once session is loaded
  useEffect(() => {
    if (session?.user) {
      form.reset({
        username: session.user.username || "",
        nativeLanguage: (localStorage.getItem("nativeLanguage") || "") as SupportedLanguage,
        preferedLanguage: (localStorage.getItem("preferedLanguage") || "") as SupportedLanguage,
      });
    }
  }, [session, form]);

  const onSubmit = async (data: UserSettingsFormData) => {
    setApiError(null);
    setSuccessMessage(null);

    // Update user profile info on backend
    const { error } = await authClient.updateUser({
      username: data.username,
    });

    if (error) {
      setApiError(error.message || "Failed to update profile info");
      return;
    }

    // Save language preferences locally
    localStorage.setItem("nativeLanguage", data.nativeLanguage);
    localStorage.setItem("preferedLanguage", data.preferedLanguage);

    setSuccessMessage("Settings saved successfully!");
    refetch();

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full py-4 animate-in fade-in duration-300">
      {/* Side info panel */}
      <div className="md:col-span-1">
        <div className="p-6 rounded-3xl bg-muted/30 border border-border/40 backdrop-blur-xs h-full flex flex-col">
          <div className="size-16 rounded-full bg-linear-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-inner mb-4 border border-primary/20">
            {session?.user?.name
              ? session.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()
              : "U"}
          </div>
          <h3 className="font-heading font-bold text-lg text-foreground truncate">
            {session?.user?.name || "Legendary Learner"}
          </h3>
          <p className="text-xs text-muted-foreground truncate mb-4">
            @{session?.user?.username || "username"}
          </p>
          <div className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-4">
            Configure your personal profile details and native/preferred study languages here. Preferences take effect instantly across all decks and reviews.
          </div>
        </div>
      </div>

      {/* Main settings form */}
      <div className="md:col-span-2">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile Card */}
          <Card className="border border-border/60 shadow-xs rounded-3xl">
            <CardHeader className="flex flex-row items-center gap-3 pb-4">
              <div className="p-2 bg-primary/10 rounded-2xl text-primary">
                <User className="size-5" />
              </div>
              <div>
                <CardTitle className="text-md font-bold">Profile Details</CardTitle>
                <CardDescription className="text-xs">
                  Your public display name and screen username
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Controller
                    name="username"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="Username"
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
                </FieldGroup>
              </FieldSet>
            </CardContent>
          </Card>

          {/* Languages Card */}
          <Card className="border border-border/60 shadow-xs rounded-3xl">
            <CardHeader className="flex flex-row items-center gap-3 pb-4">
              <div className="p-2 bg-primary/10 rounded-2xl text-primary">
                <Globe className="size-5" />
              </div>
              <div>
                <CardTitle className="text-md font-bold">Language Preferences</CardTitle>
                <CardDescription className="text-xs">
                  Choose your native language and the target study language
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Controller
                    name="nativeLanguage"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Native Language</FieldLabel>
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
                            className="h-9 w-full min-w-0 rounded-3xl border bg-input/50 pl-3 pr-10 py-1 text-base transition-[color,box-shadow,background-color] outline-none appearance-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm text-foreground cursor-pointer"
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
                        <FieldLabel htmlFor={field.name}>Preferred Language</FieldLabel>
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
                            className="h-9 w-full min-w-0 rounded-3xl border  bg-input/50 pl-3 pr-10 py-1 text-base transition-[color,box-shadow,background-color] outline-none appearance-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm text-foreground cursor-pointer"
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
                          id="preferedLanguage-error"
                          errors={[fieldState.error]}
                        />
                      </Field>
                    )}
                  />
                </FieldGroup>
              </FieldSet>
            </CardContent>
          </Card>

          {/* Messages & Save Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
            <div className="flex-1">
              <FormErrorMessage message={apiError} />
              {successMessage && (
                <div className="flex items-center gap-1.5 text-xs font-semibold dark:text-emerald-400 bg-emerald-500/10 py-2 px-3 rounded-2xl w-fit animate-in fade-in duration-300">
                  <Check className="size-3.5" />
                  {successMessage}
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer gap-2 px-6 min-w-32 self-end sm:self-auto"
            >
              {isSubmitting ? (
                <>
                  <Spinner />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
