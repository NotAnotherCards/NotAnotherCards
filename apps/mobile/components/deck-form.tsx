import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { deckFormSchema, type DeckFormValues } from '@/lib/deck-schema';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FormField } from './ui/form-field';
import { Text } from './ui/text';

type DeckFormProps = {
  title: string;
  initialValues?: DeckFormValues;
  error?: string | null;
  onSubmit: (values: DeckFormValues) => Promise<void>;
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
