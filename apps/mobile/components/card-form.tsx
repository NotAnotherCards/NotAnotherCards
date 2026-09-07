import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { cardFormSchema, type CardFormValues } from '@/lib/card-schema';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FormField } from './ui/form-field';
import { Text } from './ui/text';

type CardFormProps = {
  title: string;
  initialValues?: CardFormValues;
  error?: string | null;
  onSubmit: (values: CardFormValues) => Promise<void>;
  onCancel: () => void;
};

// Front and back of a basic note. Does not know whether it creates or
// edits; the parent passes initialValues and an onSubmit (same as DeckForm).
export function CardForm({
  title,
  initialValues,
  error,
  onSubmit,
  onCancel,
}: CardFormProps) {
  const { control, handleSubmit, formState } = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: initialValues ?? { front: '', back: '' },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <FormField
          control={control}
          name="front"
          label="Front"
          placeholder="The question or prompt"
          multiline
          autoFocus
        />
        <FormField
          control={control}
          name="back"
          label="Back"
          placeholder="The answer"
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
