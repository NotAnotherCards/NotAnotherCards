import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";

const cardSchema = z.object({
  lemma: z.string().min(1, "Word/lemma content is required").max(1000, "Content cannot exceed 1000 characters"),
  translation: z.string().min(1, "Translation content is required").max(1000, "Translation cannot exceed 1000 characters"),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().or(z.literal("")),
});

type CardFormData = z.infer<typeof cardSchema>;

interface CardFormProps {
  initialData?: { lemma: string; translation: string; notes?: string | null };
  onSubmit: (data: { lemma: string; translation: string; notes?: string }) => void;
  onCancel: () => void;
  title: string;
}

export function CardForm({ initialData, onSubmit, onCancel, title }: CardFormProps) {
  const form = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      lemma: "",
      translation: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        lemma: initialData.lemma,
        translation: initialData.translation,
        notes: initialData.notes || "",
      });
    }
  }, [initialData, form]);

  const handleFormSubmit = (data: CardFormData) => {
    onSubmit({
      lemma: data.lemma.trim(),
      translation: data.translation.trim(),
      notes: data.notes?.trim() || undefined,
    });
  };

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
              <Layers className="size-4.5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>
              Create the question and answer for this study card.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4">
            <FieldSet>
              <FieldGroup>
                <Controller
                  name="lemma"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Word / Lemma (Question, term, or prompt)
                      </FieldLabel>
                      <textarea
                        {...field}
                        id={field.name}
                        placeholder="e.g. ¿Cómo estás?"
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={fieldState.invalid ? "lemma-error" : undefined}
                        className={`w-full flex min-h-20 rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${
                          fieldState.invalid
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : "border-input focus-visible:ring-ring"
                        }`}
                        autoFocus
                      />
                      <FieldError id="lemma-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="translation"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Translation (Answer, definition, or translation)
                      </FieldLabel>
                      <textarea
                        {...field}
                        id={field.name}
                        placeholder="e.g. How are you? (Informal)"
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={fieldState.invalid ? "translation-error" : undefined}
                        className={`w-full flex min-h-20 rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${
                          fieldState.invalid
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : "border-input focus-visible:ring-ring"
                        }`}
                      />
                      <FieldError id="translation-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="notes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Explanation & Notes (Optional)
                      </FieldLabel>
                      <textarea
                        {...field}
                        id={field.name}
                        placeholder="Add secondary explanations, context, grammar tips, or hints..."
                        rows={2}
                        aria-invalid={fieldState.invalid}
                        className="w-full flex min-h-15 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </FieldGroup>
            </FieldSet>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t border-border/40 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer">
              Save Card
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
