import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { authClient, checkUsernameAvailable } from '@/lib/auth-client';
import { ChevronDown, User, Globe, Save, Check } from 'lucide-react';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { LANGUAGES } from '@/lib/languages';
import { useStore } from '@/hooks/useStore';
import { ProfileFormValues, userProfileFormSchema } from '@repo/schemas';

export function Profile() {
  const { data: session, refetch } = authClient.useSession();
  const { profile, updateUserProfile } = useStore();
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(userProfileFormSchema),
    defaultValues: {
      username: '',
      native_language_id: '',
      target_language_id: '',
    },
  });

  const { isSubmitting, isDirty } = form.formState;

  const nativeLanguage = form.watch('native_language_id');

  // Sync form values once profile or session is loaded
  useEffect(() => {
    if (profile) {
      form.reset({
        username: profile.username || '',
        native_language_id: profile.native_language_id || '',
        target_language_id: profile.target_language_id || '',
      });
    } else if (session?.user) {
      form.reset({
        username: '',
        native_language_id: '',
        target_language_id: '',
      });
    }
  }, [profile, session, form]);

  useEffect(() => {
    if (isDirty) {
      setSuccessMessage(null);
      setApiError(null);
    }
  }, [isDirty]);

  const onSubmit = async (data: ProfileFormValues) => {
    setApiError(null);
    setSuccessMessage(null);
    try {
      const newUsername = data.username || "";
      const currentUsername = profile?.username || "";

      if (newUsername && newUsername !== currentUsername) {
        const available = await checkUsernameAvailable(newUsername);
        if (!available) {
          throw new Error("Username is already taken");
        }
      }

      await updateUserProfile({
        username: newUsername,
        native_language_id: data.native_language_id || "",
        target_language_id: data.target_language_id || "",
      });

      setSuccessMessage('Settings saved successfully!');
      void refetch();
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Profile Card */}
      <Card className="border border-border/60 shadow-xs rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-primary/10 rounded-2xl text-primary">
            <User className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">
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
                      value={field.value ?? ''}
                      id={field.name}
                      placeholder="Username"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.invalid ? 'username-error' : undefined
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
            <CardTitle className="text-base font-bold">
              Language Preferences
            </CardTitle>
            <CardDescription className="text-xs">
              Configure your native language and the language you want to study
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
                        value={field.value ?? ''}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? 'native_language_id-error'
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
                      Target Language
                    </FieldLabel>
                    <div className="relative w-full">
                      <select
                        {...field}
                        value={field.value ?? ''}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? 'target_language_id-error'
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
          disabled={isSubmitting || !isDirty}
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
  );
}
