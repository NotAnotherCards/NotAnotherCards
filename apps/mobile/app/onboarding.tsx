import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
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
      <View className="flex-row flex-wrap gap-2">
        {LANGUAGES.filter((language) => language.value !== exclude).map(
          (language) => {
            const selected = language.value === value;
            return (
              <Pressable
                key={language.value}
                accessibilityRole="radio"
                accessibilityLabel={`${label}: ${language.label}`}
                accessibilityState={{ selected }}
                className={`rounded-lg border px-3 py-2 ${
                  selected ? 'border-primary bg-primary/10' : 'border-input'
                }`}
                onPress={() => onChange(language.value)}
              >
                <Text className={selected ? 'font-semibold text-primary' : ''}>
                  {language.label}
                </Text>
              </Pressable>
            );
          },
        )}
      </View>
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { data: session, refetch } = authClient.useSession();
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
