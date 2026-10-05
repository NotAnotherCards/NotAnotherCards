import { useTranslation } from 'react-i18next';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pressable, View } from 'react-native';
import { gendersFor } from '@repo/schemas';
import { WordNoteEditableFieldsV1 } from '@repo/offline-db';
import { z } from 'zod';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FormField } from './ui/form-field';
import { Text } from './ui/text';
import { SparklesIcon } from './ui/icon';
import { apiClient } from '@/lib/api-client';
import { useConnected } from '@/lib/connectivity';
import { aiErrorMessage } from '@/lib/ai-error';
import { uiErrorText } from '@/lib/errors';
import { useWordNoteGeneration } from '@repo/api-client/react';

const editableFields = WordNoteEditableFieldsV1;
const blank = z.string().trim().pipe(z.literal(''));
const wordFormSchema = editableFields.extend({
  example: editableFields.shape.example.or(blank),
  example_translation: editableFields.shape.example_translation.or(blank),
  part_of_speech: editableFields.shape.part_of_speech.or(blank),
  gender: editableFields.shape.gender.or(blank),
  pronunciation: editableFields.shape.pronunciation.or(blank),
  notes: editableFields.shape.notes.or(blank),
});

export type WordFormValues = z.infer<typeof editableFields>;
type WordFormFields = z.infer<typeof wordFormSchema>;

const OPTIONAL_FIELDS = [
  ['part_of_speech', 'deck.word_form.part_of_speech'],
  ['pronunciation', 'deck.word_form.pronunciation'],
  ['example', 'deck.word_form.example'],
  ['example_translation', 'deck.word_form.example_translation'],
  ['notes', 'deck.word_form.notes'],
] as const;

export function WordNoteForm({
  title,
  initialValues,
  deckId,
  nativeLanguageId,
  targetLanguageId,
  error,
  onSubmit,
  onCancel,
  headerAction,
  busy = false,
}: {
  title: string;
  initialValues?: Partial<WordFormValues>;
  deckId?: string;
  nativeLanguageId?: string | null;
  targetLanguageId?: string | null;
  error?: string | null;
  onSubmit: (values: WordFormValues) => Promise<void>;
  onCancel: () => void;
  headerAction?: ReactNode;
  // Another write of the editor is running, e.g. its delete.
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState, getValues, setValue, watch } =
    useForm<WordFormFields>({
      resolver: zodResolver(wordFormSchema, {
        error: (issue) =>
          issue.code === 'too_small'
            ? issue.path?.[0] === 'word'
              ? 'mobile.messages.word_required'
              : 'mobile.messages.translation_required'
            : undefined,
      }),
      defaultValues: {
        word: initialValues?.word ?? '',
        translation: initialValues?.translation ?? '',
        example: initialValues?.example ?? '',
        example_translation: initialValues?.example_translation ?? '',
        part_of_speech: initialValues?.part_of_speech ?? '',
        gender: initialValues?.gender ?? '',
        pronunciation: initialValues?.pronunciation ?? '',
        notes: initialValues?.notes ?? '',
      },
    });
  const genders = gendersFor(targetLanguageId);
  const connected = useConnected();
  const word = watch('word');
  const generation = useWordNoteGeneration(apiClient);
  const { cancel } = generation;
  const generating = generation.status === 'generating';
  const paused = generation.status === 'paused';
  const [inputError, setInputError] = useState<string | null>(null);
  const generationError = inputError
    ? t(inputError)
    : generation.error
      ? uiErrorText(aiErrorMessage(generation.error), t)
      : null;

  useEffect(() => {
    cancel();
    setInputError(null);
  }, [deckId, nativeLanguageId, targetLanguageId, cancel]);
  useEffect(() => {
    setInputError(cancel() ? 'mobile.messages.word_changed' : null);
  }, [word, cancel]);

  const fill = async () => {
    if (
      busy ||
      formState.isSubmitting ||
      !connected ||
      !word.trim() ||
      !deckId ||
      !nativeLanguageId ||
      !targetLanguageId
    )
      return;
    setInputError(null);
    const fields = paused
      ? await generation.resume()
      : await generation.generate({
          deckId,
          word: word.trim(),
          direction: 'target',
          nativeLanguageId,
          targetLanguageId,
        });
    if (!fields) return;
    if (getValues('word').trim() !== word.trim()) {
      setInputError('mobile.messages.word_changed');
      return;
    }
    for (const name of [
      'translation',
      'gender',
      ...OPTIONAL_FIELDS.map(([name]) => name),
    ] as const) {
      if (!getValues(name)?.trim() && fields[name])
        setValue(name, fields[name], {
          shouldDirty: true,
          shouldValidate: true,
        });
    }
  };

  const submit = async (values: WordFormFields) => {
    const cleaned: WordFormValues = {
      word: values.word,
      translation: values.translation,
    };
    for (const [name] of OPTIONAL_FIELDS) {
      const value = values[name]?.trim();
      if (value) cleaned[name] = value;
    }
    const gender = values.gender?.trim();
    if (gender && genders.length > 0) cleaned.gender = gender;
    await onSubmit(cleaned);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex-1">{title}</CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent className="gap-4">
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <FormField
              control={control}
              name="word"
              label={t('deck.words.col_word')}
              placeholder={t('deck.word_form.word_placeholder')}
              autoFocus
            />
          </View>
          <Button
            className="h-12 sm:h-12"
            accessibilityLabel={
              paused
                ? t('mobile.messages.check_generation')
                : t('mobile.messages.fill_ai')
            }
            disabled={
              !word.trim() ||
              !connected ||
              generating ||
              busy ||
              formState.isSubmitting ||
              !deckId ||
              !nativeLanguageId ||
              !targetLanguageId
            }
            onPress={() => void fill()}
          >
            <SparklesIcon size={18} className="text-primary-foreground" />
            <Text>
              {paused
                ? t('mobile.messages.check_generation')
                : t('mobile.messages.fill')}
            </Text>
          </Button>
        </View>
        {!connected && (
          <Text className="text-muted-foreground">
            {t('mobile.messages.fill_offline')}
          </Text>
        )}
        {generating && (
          <Text accessibilityLiveRegion="polite">
            {t('mobile.messages.generating')}
          </Text>
        )}
        {paused && (
          <Text accessibilityLiveRegion="polite">
            {t('mobile.messages.generation_pending')}
          </Text>
        )}
        {generationError && (
          <Text accessibilityLiveRegion="polite" className="text-destructive">
            {generationError}
          </Text>
        )}
        <FormField
          control={control}
          name="translation"
          label={t('deck.words.col_translation')}
          placeholder={t('mobile.messages.meaning_placeholder')}
        />
        {OPTIONAL_FIELDS.map(([name, label]) => (
          <FormField
            key={name}
            control={control}
            name={name}
            label={t(label)}
            placeholder={t('mobile.messages.optional')}
            multiline={name === 'notes'}
          />
        ))}
        {genders.length > 0 && (
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <View className="gap-1">
                <Text className="text-sm font-medium">
                  {t('deck.word_form.gender')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {genders.map((gender) => (
                    <Pressable
                      key={gender}
                      accessibilityRole="radio"
                      accessibilityLabel={t('mobile.messages.gender_option', {
                        gender,
                      })}
                      accessibilityState={{ selected: field.value === gender }}
                      className={`rounded-lg border px-3 py-2 ${
                        field.value === gender
                          ? 'border-primary bg-accent'
                          : 'border-input'
                      }`}
                      onPress={() => field.onChange(gender)}
                    >
                      <Text>{gender}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          />
        )}
        {error && <Text className="text-destructive">{error}</Text>}
        <View className="flex-row gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() => {
              cancel();
              onCancel();
            }}
            disabled={formState.isSubmitting || busy}
          >
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button
            className="flex-1"
            loading={formState.isSubmitting}
            disabled={busy || generating}
            onPress={handleSubmit(submit)}
          >
            <Text>{t('common.save')}</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
