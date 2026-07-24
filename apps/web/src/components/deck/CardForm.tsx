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
  front: z.string().min(1, "Front side content is required").max(1000, "Front content cannot exceed 1000 characters"),
  back: z.string().min(1, "Back side content is required").max(1000, "Back content cannot exceed 1000 characters"),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().or(z.literal("")),
});

type CardFormData = z.infer<typeof cardSchema>;

interface CardFormProps {
  initialData?: { front: string; back: string; notes?: string };
  onSubmit: (data: { front: string; back: string; notes?: string }) => void;
  onCancel: () => void;
  title: string;
}

export function CardForm({ initialData, onSubmit, onCancel, title }: CardFormProps) {
  const form = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      front: "",
      back: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        front: initialData.front,
        back: initialData.back,
        notes: initialData.notes || "",
      });
    }
  }, [initialData, form]);

  const handleFormSubmit = (data: CardFormData) => {
    onSubmit({
      front: data.front.trim(),
      back: data.back.trim(),
      notes: data.notes?.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-lg shadow-2xl border border-border/80 animate-in zoom-in-95 duration-200">
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
                  name="front"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Front Side (Question, term, or prompt)
                      </FieldLabel>
                      <textarea
                        {...field}
                        id={field.name}
                        placeholder="e.g. ¿Cómo estás?"
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={fieldState.invalid ? "front-error" : undefined}
                        className={`w-full flex min-h-20 rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${
                          fieldState.invalid
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : "border-input focus-visible:ring-ring"
                        }`}
                        autoFocus
                      />
                      <FieldError id="front-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="back"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Back Side (Answer, definition, or translation)
                      </FieldLabel>
                      <textarea
                        {...field}
                        id={field.name}
                        placeholder="e.g. How are you? (Informal)"
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={fieldState.invalid ? "back-error" : undefined}
                        className={`w-full flex min-h-20 rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${
                          fieldState.invalid
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : "border-input focus-visible:ring-ring"
                        }`}
                      />
                      <FieldError id="back-error" errors={[fieldState.error]} />
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
