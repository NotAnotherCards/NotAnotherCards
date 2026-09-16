import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import type { UserProfileRecord } from '@repo/offline-db';
import { type ProfileFormValues, userProfileFormSchema } from '@repo/schemas';
import { apiErrorMessage } from '@/lib/errors';
import { checkUsernameAvailable } from '@/lib/profile';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { FormField } from './ui/form-field';
import { GlobeIcon, UserIcon } from './ui/icon';
import { Text } from './ui/text';
import { LanguageField } from './language-field';

function valuesOf(profile: UserProfileRecord | null): ProfileFormValues {
  return {
    username: profile?.username ?? '',
    native_language_id: profile?.native_language_id ?? '',
    target_language_id: profile?.target_language_id ?? '',
  };
}

// Web's Profile & Languages settings. The same fields and validation as
// onboarding; the difference is that a profile exists and can be edited.
export function ProfileForm({
  profile,
  onSave,
}: {
  profile: UserProfileRecord | null;
  onSave: (values: ProfileFormValues) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, formState, watch, setValue, reset } =
    useForm<ProfileFormValues>({
      resolver: zodResolver(userProfileFormSchema),
      defaultValues: valuesOf(profile),
    });
  const nativeLanguage = watch('native_language_id');
  const targetLanguage = watch('target_language_id');

  // A sync landing while the user types must not overwrite their edits:
  // take the stored profile only while the form is untouched.
  useEffect(() => {
    if (!formState.isDirty) reset(valuesOf(profile));
  }, [profile, formState.isDirty, reset]);

  useEffect(() => {
    if (nativeLanguage && nativeLanguage === targetLanguage) {
      setValue('target_language_id', '', { shouldValidate: true });
    }
  }, [nativeLanguage, setValue, targetLanguage]);

  const onSubmit = async (values: ProfileFormValues) => {
    setError(null);
    setSaved(false);
    try {
      if (values.username !== (profile?.username ?? '')) {
        const available = await checkUsernameAvailable(values.username);
        if (!available) {
          setError('Username is already taken');
          return;
        }
      }
      await onSave(values);
      reset(values);
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <View className="gap-4">
      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <UserIcon size={20} className="text-foreground" />
          <View className="flex-1">
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Your public screen username</CardDescription>
          </View>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="username"
            label="Username"
            placeholder="your-username"
            autoCapitalize="none"
            autoComplete="username"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <GlobeIcon size={20} className="text-foreground" />
          <View className="flex-1">
            <CardTitle>Language Preferences</CardTitle>
            <CardDescription>
              Your native language and the language you study
            </CardDescription>
          </View>
        </CardHeader>
        <CardContent className="gap-4">
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
        </CardContent>
      </Card>

      {error && <Text className="text-center text-destructive">{error}</Text>}
      {saved && !formState.isDirty && (
        <Text className="text-center text-muted-foreground">Saved</Text>
      )}
      <Button
        loading={formState.isSubmitting}
        disabled={!formState.isDirty || formState.isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        <Text>Save changes</Text>
      </Button>
    </View>
  );
}
