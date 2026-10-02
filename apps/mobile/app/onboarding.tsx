import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { type ProfileFormValues, userProfileFormSchema } from '@repo/schemas';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { completeOnboarding } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { LanguageField } from '@/components/language-field';
import {
  useTwoFactorChallengeState,
  useTwoFactorDeepLinkPending,
} from '@/lib/two-factor-challenge';

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const challenge = useTwoFactorChallengeState();
  const deepLinkPending = useTwoFactorDeepLinkPending();
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
    if (
      challenge.hydrated &&
      !challenge.pending &&
      !deepLinkPending &&
      session?.user.onBoardingComplete
    ) {
      router.replace('/dashboard');
    }
  }, [challenge, deepLinkPending, router, session?.user.onBoardingComplete]);

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

  if (isPending || !challenge.hydrated) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (deepLinkPending || challenge.pending) {
    return <Redirect href="/two-factor" />;
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
        <Button onPress={() => refetch()}>
          <Text>{t('common.retry')}</Text>
        </Button>
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
          <Text className="text-2xl font-semibold">
            {t('onboarding.title')}
          </Text>
          <Text className="text-muted-foreground">
            {t('onboarding.description')}
          </Text>
        </View>

        <FormField
          control={control}
          name="username"
          label={t('onboarding.username')}
          placeholder={t('dashboard.settings.profile.username_placeholder')}
          autoCapitalize="none"
          autoComplete="username"
        />

        <Controller
          control={control}
          name="native_language_id"
          render={({ field, fieldState }) => (
            <LanguageField
              label={t('onboarding.nativeLanguage')}
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
              label={t('onboarding.targetLanguage')}
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
          loading={formState.isSubmitting}
          onPress={handleSubmit(onSubmit)}
        >
          <Text>{t('onboarding.submit')}</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
