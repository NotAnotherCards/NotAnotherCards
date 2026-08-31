import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { deckFormSchema, type DeckFormValues } from '@repo/schemas';
import { Button } from './ui/button';
import { FormField } from './ui/form-field';
import { Text } from './ui/text';

type DeckFormProps = {
  title: string;
  initialValues?: DeckFormValues;
  error?: string | null;
  onSubmit: (values: { title: string; description: string }) => Promise<void>;
  onCancel: () => void;
};

export function DeckForm({
  title,
  initialValues,
  error,
  onSubmit,
  onCancel,
}: DeckFormProps) {
  const { control, handleSubmit, formState } = useForm<DeckFormValues>({
    resolver: zodResolver(deckFormSchema),
    defaultValues: initialValues ?? { title: '', description: '' },
  });

  return (
    <View className="gap-4 rounded-xl border border-border bg-card p-4">
      <Text className="text-lg font-semibold">{title}</Text>
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
      {error && <Text className="text-destructive">{error}</Text>}
      <View className="flex-row gap-2">
        <Button
          label="Cancel"
          className="flex-1 bg-muted"
          onPress={onCancel}
          disabled={formState.isSubmitting}
        />
        <Button
          label="Save"
          className="flex-1"
          loading={formState.isSubmitting}
          // awaited so isSubmitting covers the write, and a failed write
          // keeps the form open with its values
          onPress={handleSubmit((values) =>
            onSubmit({
              title: values.title,
              description: values.description ?? '',
            }),
          )}
        />
      </View>
    </View>
  );
}
