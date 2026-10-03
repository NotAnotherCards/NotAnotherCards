import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import type { UserProfileRecord } from '@repo/offline-db';
import { type ProfileFormValues, userProfileFormSchema } from '@repo/schemas';
import { toUiError, UiError, uiErrorText } from '@/lib/errors';
import { checkUsernameAvailable, type profileWrites } from '@/lib/profile';
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

// Web's Profile & Languages settings, with the same fields and validation.
// Saving is per field, not behind a Save button (#290): a language saves on
// tap like the preferences above it, the username when the field is left.
// A button under a phone-height form is easy to miss, and the draft it
// holds is what a remount loses.
export function ProfileForm({
  profile,
  onSave,
}: {
  profile: UserProfileRecord | null;
  onSave: ReturnType<typeof profileWrites>['update'];
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    control,
    formState,
    getValues,
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(userProfileFormSchema),
    defaultValues: valuesOf(profile),
  });
  const nativeLanguage = watch('native_language_id');
  const targetLanguage = watch('target_language_id');
  const storedUsername = profile?.username ?? '';
  // Saves overlap: a slow username check can still be running when a
  // language is tapped. Only the newest one may write, or the older one
  // would put its stale values back.
  const saveCount = useRef(0);
  const takenProfile = useRef(profile);

  // A sync landing while the user types must not overwrite their edits: take
  // the stored profile when it actually changes, and only while the form is
  // untouched. Reacting to isDirty alone would fire right after a save, when
  // the parent can still be holding the profile from before it.
  useEffect(() => {
    if (profile === takenProfile.current) return;
    takenProfile.current = profile;
    if (!formState.isDirty) reset(valuesOf(profile));
  }, [profile, formState.isDirty, reset]);

  useEffect(() => {
    if (nativeLanguage && nativeLanguage === targetLanguage) {
      setValue('target_language_id', '', { shouldValidate: true });
    }
  }, [nativeLanguage, setValue, targetLanguage]);

  const save = async (values: ProfileFormValues) => {
    const save = ++saveCount.current;
    const superseded = () => save !== saveCount.current;
    setError(null);
    setSaved(false);
    try {
      if (values.username !== storedUsername) {
        const available = await checkUsernameAvailable(values.username);
        if (superseded()) return;
        if (!available) {
          setError(new UiError('dashboard.settings.profile.username_taken'));
          return;
        }
      }
      await onSave(values);
      if (superseded()) return;
      reset(values);
      setSaved(true);
    } catch (err) {
      if (!superseded()) setError(toUiError(err));
    }
  };

  // handleSubmit runs the schema first, so an invalid field shows its
  // message and nothing is written.
  const saveNow = handleSubmit(save);

  const saveUsername = () => {
    if (getValues('username') !== storedUsername) void saveNow();
  };

  // Switching sub-tab unmounts the field, and taps are handled while the
  // keyboard is up, so onEndEditing does not always come: save what is in
  // the field on the way out.
  const saveUsernameOnUnmount = useRef(saveUsername);
  saveUsernameOnUnmount.current = saveUsername;
  useEffect(() => () => saveUsernameOnUnmount.current(), []);

  const saveLanguage = (
    field: 'native_language_id' | 'target_language_id',
    value: string,
  ) => {
    setValue(field, value, { shouldDirty: true, shouldValidate: true });
    void saveNow();
  };

  return (
    <View className="gap-4">
      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <UserIcon size={20} className="text-foreground" />
          <View className="flex-1">
            <CardTitle>{t('dashboard.settings.profile.title')}</CardTitle>
            <CardDescription>{t('mobile.profile_description')}</CardDescription>
          </View>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="username"
            label={t('dashboard.settings.profile.username')}
            placeholder={t('dashboard.settings.profile.username_placeholder')}
            autoCapitalize="none"
            autoComplete="username"
            returnKeyType="done"
            // Leaving the field saves it; typing does not, so a half-typed
            // name never reaches the availability check.
            onEndEditing={saveUsername}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <GlobeIcon size={20} className="text-foreground" />
          <View className="flex-1">
            <CardTitle>
              {t('dashboard.settings.profile.language_title')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.settings.profile.language_description')}
            </CardDescription>
          </View>
        </CardHeader>
        <CardContent className="gap-4">
          <Controller
            control={control}
            name="native_language_id"
            render={({ field, fieldState }) => (
              <LanguageField
                label={t('dashboard.settings.profile.native_language')}
                value={field.value}
                onChange={(value) => saveLanguage('native_language_id', value)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="target_language_id"
            render={({ field, fieldState }) => (
              <LanguageField
                label={t('dashboard.settings.profile.target_language')}
                value={field.value}
                onChange={(value) => saveLanguage('target_language_id', value)}
                error={fieldState.error?.message}
                exclude={nativeLanguage}
              />
            )}
          />
        </CardContent>
      </Card>

      {error && (
        <Text className="text-center text-destructive">
          {uiErrorText(error, t)}
        </Text>
      )}
      {saved && !formState.isDirty && (
        <Text className="text-center text-muted-foreground">
          {t('mobile.saved')}
        </Text>
      )}
    </View>
  );
}
