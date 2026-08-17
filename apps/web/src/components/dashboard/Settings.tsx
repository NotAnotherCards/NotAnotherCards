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
import {
  ChevronDown,
  User,
  Globe,
  Save,
  Check,
  Settings as SettingsIcon,
} from "lucide-react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import { LANGUAGES } from "../OnBoarding";
import { ThemeChanger } from "../ThemeChanger";
import { UserProfileRow, UserProfileRowType } from "@repo/offline-db";
import { useStore } from "@/hooks/useStore";

export function Settings() {
  const { data: session, refetch } = authClient.useSession();
  const { profile, updateUserProfile } = useStore();
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "settings">(
    "profile",
  );

  const form = useForm<UserProfileRowType>({
    resolver: zodResolver(UserProfileRow),
    defaultValues: {
      username: "",
      native_language_id: "",
      target_language_id: "",
    },
  });

  const { isSubmitting } = form.formState;

  // Sync form values once profile or session is loaded
  useEffect(() => {
    if (profile) {
      form.reset({
        username: profile.username || "",
        native_language_id: profile.native_language_id || "",
        target_language_id: profile.target_language_id || "",
      });
    } else if (session?.user) {
      form.reset({
        username: "",
        native_language_id: "",
        target_language_id: "",
      });
    }
  }, [profile, session, form]);

  const onSubmit = async (data: UserProfileRowType) => {
    setApiError(null);
    setSuccessMessage(null);
    try {
      // Save language preferences and username to local RemelonDB
      await updateUserProfile({
        username: data.username || "",
        native_language_id: data.native_language_id || "",
        target_language_id: data.target_language_id || "",
      });

      setSuccessMessage("Settings saved successfully!");
      refetch();
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setApiError(err.message || "An unexpected error occurred");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full py-4 animate-in fade-in duration-300">
      {/* Side info panel */}
      <div className="md:col-span-1">
        <div className="p-6 rounded-3xl bg-muted/30 border border-border/40 backdrop-blur-xs h-full flex flex-col justify-between">
          <div>
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
            <p className="text-xs text-muted-foreground truncate mb-6">
              @{profile?.username || "username"}
            </p>

            {/* Navigation subtabs */}
            <div className="flex flex-col gap-1 border-t border-border/30 pt-6">
              <Button
                type="button"
                onClick={() => setActiveSubTab("profile")}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  activeSubTab === "profile"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <User className="size-4" />
                Profile & Languages
              </Button>
              <Button
                type="button"
                onClick={() => setActiveSubTab("settings")}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  activeSubTab === "settings"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <SettingsIcon className="size-4" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main settings content */}
      <div className="md:col-span-2">
        {activeSubTab === "profile" && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Card */}
            <Card className="border border-border/60 shadow-xs rounded-3xl">
              <CardHeader className="flex flex-row items-center gap-3 pb-4">
                <div className="p-2 bg-primary/10 rounded-2xl text-primary">
                  <User className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-md font-bold">
                    Profile Details
                  </CardTitle>
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
                            value={field.value ?? ""}
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
                  <CardTitle className="text-md font-bold">
                    Language Preferences
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configure your native language and the language you want to
                    study
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <FieldSet>
                  <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            Preferred Language
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
                            id="target_language_id-error"
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
        )}
        {activeSubTab === "settings" && (
          <div className="space-y-6">
            <Card className="border border-border/60 shadow-xs rounded-3xl">
              <CardHeader className="flex flex-row items-center gap-3 pb-4">
                <div className="p-2 bg-primary/10 rounded-2xl text-primary">
                  <SettingsIcon className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-md font-bold">
                    Preferences
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Customize your application settings and appearance
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Theme
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Select how the application looks to you
                  </span>
                  <div className="mt-1">
                    <ThemeChanger />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
