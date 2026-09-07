import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pressable, View } from 'react-native';
import {
  BASIC_NOTE_TYPE,
  DECK_NOTE_TYPE_OPTIONS,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';
import { deckFormSchema, type DeckFormValues } from '@/lib/deck-schema';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FormField } from './ui/form-field';
import { Text } from './ui/text';
import { LanguageField } from './language-field';

type DeckFormProps = {
  title: string;
  initialValues?: Pick<DeckFormValues, 'title' | 'description'>;
  defaultLanguages?: {
    nativeLanguageId: string | null;
    targetLanguageId: string | null;
  };
  showNoteType?: boolean;
  error?: string | null;
  onSubmit: (values: DeckFormValues) => Promise<void>;
  onCancel: () => void;
};

export function DeckForm({
  title,
  initialValues,
  defaultLanguages,
  showNoteType = false,
  error,
  onSubmit,
  onCancel,
}: DeckFormProps) {
  const { control, handleSubmit, formState, watch } = useForm<DeckFormValues>({
    resolver: zodResolver(deckFormSchema),
    defaultValues: {
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      noteType: BASIC_NOTE_TYPE,
      nativeLanguageId: defaultLanguages?.nativeLanguageId ?? '',
      targetLanguageId: defaultLanguages?.targetLanguageId ?? '',
    },
  });
  const noteType = watch('noteType');
  const nativeLanguageId = watch('nativeLanguageId');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <FormField
          control={control}
          name="title"
          label="Deck title"
          placeholder="e.g. Spanish vocabulary"
          autoFocus
        />
        <FormField
          control={control}
          name="description"
          label="Description"
          placeholder="Optional"
          multiline
        />
        {showNoteType && (
          <Controller
            control={control}
            name="noteType"
            render={({ field }) => (
              <View className="gap-1">
                <Text className="text-sm font-medium">
                  What goes in this deck
                </Text>
                <View className="flex-row gap-2">
                  {DECK_NOTE_TYPE_OPTIONS.map(({ value, label }) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: field.value === value }}
                      className={`flex-1 rounded-lg border px-3 py-2 ${
                        field.value === value
                          ? 'border-primary bg-accent'
                          : 'border-input'
                      }`}
                      onPress={() => field.onChange(value)}
                    >
                      <Text>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          />
        )}
        {showNoteType && noteType === WORD_NOTE_TYPE && (
          <>
            <Controller
              control={control}
              name="nativeLanguageId"
              render={({ field, fieldState }) => (
                <LanguageField
                  label="Your language"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="targetLanguageId"
              render={({ field, fieldState }) => (
                <LanguageField
                  label="Language you are learning"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  exclude={nativeLanguageId}
                />
              )}
            />
          </>
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
            // awaited so isSubmitting covers the write, and a failed write
            // keeps the form open with its values
            onPress={handleSubmit((values) => onSubmit(values))}
          >
            <Text>Save</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
