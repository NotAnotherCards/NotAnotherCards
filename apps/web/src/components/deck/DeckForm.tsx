import { Button } from '@/components/ui/button';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LANGUAGES } from '@repo/schemas';
import { BASIC_NOTE_TYPE, WORD_NOTE_TYPE } from '@repo/offline-db';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';

// A deck's note type is chosen once, at creation: its notes are compiled
// against it, so it cannot change under them. The edit form omits it.
const deckSchema = z.object({
  noteType: z.enum([BASIC_NOTE_TYPE, WORD_NOTE_TYPE]),
  nativeLanguageId: z.string().optional().or(z.literal('')),
  targetLanguageId: z.string().optional().or(z.literal('')),
  title: z
    .string()
    .min(1, 'Deck title is required')
    .max(100, 'Deck title cannot exceed 100 characters'),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

const deckFormSchema = deckSchema.superRefine((data, ctx) => {
  if (data.noteType !== WORD_NOTE_TYPE) return;
  for (const field of ['nativeLanguageId', 'targetLanguageId'] as const) {
    if (!data[field]) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: 'A word deck needs both languages',
      });
    }
  }
});

type DeckFormData = z.infer<typeof deckSchema>;

interface DeckFormProps {
  initialData?: { title: string; description: string };
  /** Prefills a word deck's pair; the user can change it before creating. */
  defaultLanguages?: {
    nativeLanguageId: string | null;
    targetLanguageId: string | null;
  };
  /** Editing cannot change the note type, so the choice is hidden then. */
  showNoteType?: boolean;
  onSubmit: (data: {
    title: string;
    description: string;
    noteType: string;
    nativeLanguageId: string | null;
    targetLanguageId: string | null;
  }) => void | Promise<void>;
  error?: string | null;
  onCancel: () => void;
  title: string;
}

export function DeckForm({
  initialData,
  defaultLanguages,
  showNoteType = false,
  onSubmit,
  onCancel,
  title,
  error,
}: DeckFormProps) {
  const form = useForm<DeckFormData>({
    resolver: zodResolver(deckFormSchema),
    defaultValues: {
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      noteType: BASIC_NOTE_TYPE,
      nativeLanguageId: defaultLanguages?.nativeLanguageId ?? '',
      targetLanguageId: defaultLanguages?.targetLanguageId ?? '',
    },
  });
  const noteType = form.watch('noteType');
  const isWord = noteType === WORD_NOTE_TYPE;

  const handleFormSubmit = async (data: DeckFormData) => {
    // awaited so react-hook-form tracks isSubmitting for the write's duration
    const wordDeck = data.noteType === WORD_NOTE_TYPE;
    await onSubmit({
      title: data.title.trim(),
      description: data.description?.trim() || '',
      noteType: data.noteType,
      // Only a word deck carries languages; a basic one must carry none.
      nativeLanguageId: wordDeck
        ? (data.nativeLanguageId ?? null) || null
        : null,
      targetLanguageId: wordDeck
        ? (data.targetLanguageId ?? null) || null
        : null,
    });
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md shadow-2xl border border-border/80 animate-in zoom-in-95 duration-200"
      >
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="size-4.5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>
              Organize your study cards under a custom category.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <FieldSet>
              <FieldGroup>
                <Controller
                  name="title"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Deck Title</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="e.g. Spanish Vocabulary, AWS Cloud Practitioner"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid ? 'title-error' : undefined
                        }
                        className={
                          fieldState.invalid
                            ? 'border-destructive focus-visible:ring-destructive/30'
                            : ''
                        }
                        autoFocus
                      />
                      <FieldError
                        id="title-error"
                        errors={[fieldState.error]}
                      />
                    </Field>
                  )}
                />

                <Controller
                  name="description"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Description (Optional)
                      </FieldLabel>
                      <textarea
                        {...field}
                        id={field.name}
                        placeholder="Describe what these cards will cover..."
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        className="w-full flex min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                {showNoteType && (
                  <Controller
                    name="noteType"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>What goes in this deck</FieldLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            [BASIC_NOTE_TYPE, 'Cards', 'A front and a back'],
                            [
                              WORD_NOTE_TYPE,
                              'Words',
                              'A word, its translation, and more',
                            ],
                          ].map(([value, label, hint]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => field.onChange(value)}
                              aria-pressed={field.value === value}
                              className={`rounded-lg border p-3 text-left transition-colors ${
                                field.value === value
                                  ? 'border-primary bg-primary/5'
                                  : 'border-input hover:bg-accent/50'
                              }`}
                            >
                              <span className="block text-sm font-medium">
                                {label}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {hint}
                              </span>
                            </button>
                          ))}
                        </div>
                      </Field>
                    )}
                  />
                )}

                {showNoteType &&
                  isWord &&
                  (
                    [
                      ['nativeLanguageId', 'Your language'],
                      ['targetLanguageId', 'Language you are learning'],
                    ] as const
                  ).map(([name, label]) => (
                    <Controller
                      key={name}
                      name={name}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                          <select
                            {...field}
                            value={field.value ?? ''}
                            id={field.name}
                            aria-invalid={fieldState.invalid}
                            className={`w-full flex h-10 rounded-lg border bg-background px-3 py-2 text-sm ${
                              fieldState.invalid
                                ? 'border-destructive'
                                : 'border-input'
                            }`}
                          >
                            <option value="">Choose a language</option>
                            {LANGUAGES.map((language) => (
                              <option
                                key={language.value}
                                value={language.value}
                              >
                                {language.label}
                              </option>
                            ))}
                          </select>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  ))}
              </FieldGroup>
            </FieldSet>
          </CardContent>

          <FormErrorMessage message={error} className="mx-6 mb-4" />
          <CardFooter className="flex justify-end gap-2 border-t border-border/40 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="cursor-pointer"
            >
              Save Deck
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
