import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import {
  LANGUAGES,
  type ProfileFormValues,
  userProfileFormSchema,
} from '@repo/schemas';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { completeOnboarding } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';

function LanguageField({
  label,
  value,
  onChange,
  error,
  exclude,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  exclude?: string;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium">{label}</Text>
      {/* Two columns so four languages form a 2x2 grid. The language
          picked as native stays in its slot but is disabled, so both
          grids keep the same shape and the user sees why it is out. */}
      <View className="flex-row flex-wrap gap-2">
        {LANGUAGES.map((language) => {
          const selected = language.value === value;
          const disabled = language.value === exclude;
          return (
            <Pressable
              key={language.value}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${language.label}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              className={`basis-[48%] rounded-lg border px-3 py-2 ${
                selected ? 'border-primary bg-accent' : 'border-input'
              } ${disabled ? 'opacity-40' : ''}`}
              onPress={() => onChange(language.value)}
            >
              <Text className={selected ? 'font-semibold text-primary' : ''}>
                {language.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const [apiError, setApiError] = useState<string | null>(null);
  const { control, handleSubmit, formState, watch, setValue } =
    useForm<ProfileFormValues>({
      resolver: zodResolver(userProfileFormSchema),
      defaultValues: {
        username: '',
        native_language_id: '',
        target_language_id: '',
      },
    });
  const nativeLanguage = watch('native_language_id');
  const targetLanguage = watch('target_language_id');

  useEffect(() => {
    if (session?.user.onBoardingComplete) router.replace('/dashboard');
  }, [router, session?.user.onBoardingComplete]);

  useEffect(() => {
    if (nativeLanguage && nativeLanguage === targetLanguage) {
      setValue('target_language_id', '', { shouldValidate: true });
    }
  }, [nativeLanguage, setValue, targetLanguage]);

  const onSubmit = async (values: ProfileFormValues) => {
    setApiError(null);
    try {
      await completeOnboarding(values);
      await refetch();
    } catch (error) {
      setApiError(apiErrorMessage(error));
    }
  };

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // refetch() resolves even when the request failed and stores the error
  // reactively, so a failed session refresh lands here, not in onSubmit's
  // catch. A failed fetch is not the same as "not logged in": offer a
  // retry instead of bouncing to /login.
  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-center text-destructive">
          {apiErrorMessage(error)}
        </Text>
        <Button label="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="flex-grow justify-center p-6"
    >
      <View className="gap-4 rounded-xl border border-border bg-card p-6">
        <View className="gap-1">
          <Text className="text-2xl font-semibold">Set up your profile</Text>
          <Text className="text-muted-foreground">
            Choose your username and language preferences.
          </Text>
        </View>

        <FormField
          control={control}
          name="username"
          label="Username"
          placeholder="your-username"
          autoCapitalize="none"
          autoComplete="username"
        />

        <Controller
          control={control}
          name="native_language_id"
          render={({ field, fieldState }) => (
            <LanguageField
              label="Native language"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="target_language_id"
          render={({ field, fieldState }) => (
            <LanguageField
              label="Target language"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              exclude={nativeLanguage}
            />
          )}
        />

        {apiError && (
          <Text className="text-center text-destructive">{apiError}</Text>
        )}

        <Button
          label="Complete setup"
          loading={formState.isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </ScrollView>
  );
}
