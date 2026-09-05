import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { ChevronDown, Languages } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { WordNoteFieldsV1 } from '@repo/offline-db';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';

// The registry decides what a valid word field is; the form drops the four
// it does not own. Languages come from the deck, and the two media ids are
// file references rather than anything typed here.
const wordFields = WordNoteFieldsV1.omit({
  native_language_id: true,
  target_language_id: true,
  image: true,
  word_audio: true,
});

export type WordFormValues = z.infer<typeof wordFields>;

// Everything past word and translation is optional, and a form showing nine
// boxes at once reads as work. The required pair is always visible; the rest
// open on request, and open already if the note being edited uses any.
const DETAIL_FIELDS = [
  ['part_of_speech', 'Part of speech', 'noun, verb, adjective'],
  ['gender', 'Gender', 'der, die, das'],
  ['pronunciation', 'Pronunciation', 'IPA'],
  ['example', 'Example', 'a sentence using the word'],
  ['example_translation', 'Example translation', ''],
  ['notes', 'Notes', 'anything you want to remember'],
] as const;

// An untouched input holds '', which the registry rejects as a
// present-but-blank optional field. The form accepts it and drops it on
// submit, so an empty box means absent rather than invalid. Each rule still
// comes from the registry; only '' is added to it.
const blank = z.literal('');
const wordFormSchema = wordFields.extend({
  example: wordFields.shape.example.or(blank),
  example_translation: wordFields.shape.example_translation.or(blank),
  part_of_speech: wordFields.shape.part_of_speech.or(blank),
  gender: wordFields.shape.gender.or(blank),
  pronunciation: wordFields.shape.pronunciation.or(blank),
  notes: wordFields.shape.notes.or(blank),
});

// What the form holds may contain ''; what it submits never does.
type WordFormFields = z.infer<typeof wordFormSchema>;

interface WordCardFormProps {
  initialData?: Partial<WordFormValues>;
  onSubmit: (values: WordFormValues) => void | Promise<void>;
  error?: string | null;
  onCancel: () => void;
  title: string;
}

export function WordCardForm({
  initialData,
  onSubmit,
  onCancel,
  title,
  error,
}: WordCardFormProps) {
  const form = useForm<WordFormFields>({
    resolver: zodResolver(wordFormSchema),
    defaultValues: {
      word: initialData?.word ?? '',
      translation: initialData?.translation ?? '',
      example: initialData?.example ?? '',
      example_translation: initialData?.example_translation ?? '',
      part_of_speech: initialData?.part_of_speech ?? '',
      gender: initialData?.gender ?? '',
      pronunciation: initialData?.pronunciation ?? '',
      notes: initialData?.notes ?? '',
    },
  });
  const [showDetails, setShowDetails] = useState(
    DETAIL_FIELDS.some(([name]) => Boolean(initialData?.[name])),
  );

  const handleFormSubmit = async (values: WordFormFields) => {
    // Empty means absent: send the field away rather than as ''.
    const cleaned: WordFormValues = {
      word: values.word,
      translation: values.translation,
    };
    for (const [name] of DETAIL_FIELDS) {
      const value = values[name]?.trim();
      if (value) cleaned[name] = value;
    }
    // awaited so react-hook-form tracks isSubmitting for the write's duration
    await onSubmit(cleaned);
  };

  const inputClass = (invalid: boolean) =>
    `w-full flex rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${
      invalid
        ? 'border-destructive focus-visible:ring-destructive/30'
        : 'border-input focus-visible:ring-ring'
    }`;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg shadow-2xl border border-border/80 animate-in zoom-in-95 duration-200"
      >
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Languages className="size-4.5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>
              The word and what it means. Everything else is optional.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 max-h-[60vh] overflow-y-auto">
            <FieldSet>
              <FieldGroup>
                <Controller
                  name="word"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Word</FieldLabel>
                      <input
                        {...field}
                        id={field.name}
                        placeholder="the word you are learning"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid ? 'word-error' : undefined
                        }
                        className={inputClass(fieldState.invalid)}
                        autoFocus
                      />
                      <FieldError id="word-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="translation"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Translation</FieldLabel>
                      <input
                        {...field}
                        id={field.name}
                        placeholder="what it means in your language"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid ? 'translation-error' : undefined
                        }
                        className={inputClass(fieldState.invalid)}
                      />
                      <FieldError
                        id="translation-error"
                        errors={[fieldState.error]}
                      />
                    </Field>
                  )}
                />

                <button
                  type="button"
                  onClick={() => setShowDetails((open) => !open)}
                  aria-expanded={showDetails}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  />
                  More details
                </button>

                {showDetails &&
                  DETAIL_FIELDS.map(([name, label, placeholder]) => (
                    <Controller
                      key={name}
                      name={name}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                          <input
                            {...field}
                            value={field.value ?? ''}
                            id={field.name}
                            placeholder={placeholder}
                            aria-invalid={fieldState.invalid}
                            className={inputClass(fieldState.invalid)}
                          />
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  ))}
              </FieldGroup>
            </FieldSet>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/40 pt-4">
            {error && <FormErrorMessage message={error} />}
            <div className="flex gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
