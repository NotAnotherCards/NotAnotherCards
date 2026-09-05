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
  targetLanguageId,
  error,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialValues?: Partial<WordFormValues>;
  targetLanguageId?: string | null;
  error?: string | null;
  onSubmit: (values: WordFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { control, handleSubmit, formState } = useForm<WordFormFields>({
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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <FormField
          control={control}
          name="word"
          label="Word"
          placeholder="The word you are learning"
          autoFocus
        />
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
            disabled={formState.isSubmitting}
          >
            <Text>Cancel</Text>
          </Button>
          <Button
            className="flex-1"
            loading={formState.isSubmitting}
            onPress={handleSubmit(submit)}
          >
            <Text>Save</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
