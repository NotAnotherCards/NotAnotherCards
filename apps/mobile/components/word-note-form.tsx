import { useEffect, useRef, useState, type ReactNode } from 'react';
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

const editableFields = WordNoteEditableFieldsV1;
const blank = z.literal('');
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
  ['part_of_speech', 'Part of speech'],
  ['pronunciation', 'Pronunciation'],
  ['example', 'Example'],
  ['example_translation', 'Example translation'],
  ['notes', 'Notes'],
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
  const { control, handleSubmit, formState, getValues, setValue, watch } =
    useForm<WordFormFields>({
      resolver: zodResolver(wordFormSchema),
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
  const request = useRef<AbortController | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  useEffect(() => {
    setGenerating(false);
    setGenerationError(null);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [deckId, nativeLanguageId, targetLanguageId]);

  const fill = async () => {
    if (
      request.current ||
      busy ||
      formState.isSubmitting ||
      !connected ||
      !word.trim() ||
      !deckId ||
      !nativeLanguageId ||
      !targetLanguageId
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setGenerating(true);
    setGenerationError(null);
    try {
      const fields = await apiClient.ai.generateWordNote(
        {
          deckId,
          word: word.trim(),
          direction: 'target',
          nativeLanguageId,
          targetLanguageId,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (getValues('word').trim() !== word.trim()) {
        setGenerationError('The word changed. Fill in again for the new word.');
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
    } catch (error) {
      if (!controller.signal.aborted) setGenerationError(aiErrorMessage(error));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setGenerating(false);
      }
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
              label="Word"
              placeholder="The word you are learning"
              autoFocus
            />
          </View>
          <Button
            className="h-12 sm:h-12"
            accessibilityLabel="Fill in with AI"
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
            <Text>Fill in</Text>
          </Button>
        </View>
        {!connected && (
          <Text className="text-muted-foreground">
            Fill in needs a connection.
          </Text>
        )}
        {generating && (
          <Text accessibilityLiveRegion="polite">Generating…</Text>
        )}
        {generationError && (
          <Text accessibilityLiveRegion="polite" className="text-destructive">
            {generationError}
          </Text>
        )}
        <FormField
          control={control}
          name="translation"
          label="Translation"
          placeholder="What it means"
        />
        {OPTIONAL_FIELDS.map(([name, label]) => (
          <FormField
            key={name}
            control={control}
            name={name}
            label={label}
            placeholder="Optional"
            multiline={name === 'notes'}
          />
        ))}
        {genders.length > 0 && (
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <View className="gap-1">
                <Text className="text-sm font-medium">Gender</Text>
                <View className="flex-row flex-wrap gap-2">
                  {genders.map((gender) => (
                    <Pressable
                      key={gender}
                      accessibilityRole="radio"
                      accessibilityLabel={`Gender: ${gender}`}
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
            onPress={onCancel}
            disabled={formState.isSubmitting || busy}
          >
            <Text>Cancel</Text>
          </Button>
          <Button
            className="flex-1"
            loading={formState.isSubmitting}
            disabled={busy || generating}
            onPress={handleSubmit(submit)}
          >
            <Text>Save</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
