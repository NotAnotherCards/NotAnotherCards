import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
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

const deckSchema = z.object({
  name: z.string().min(1, "Deck name is required").max(100, "Deck name cannot exceed 100 characters"),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional().or(z.literal("")),
});

type DeckFormData = z.infer<typeof deckSchema>;

interface DeckFormProps {
  initialData?: { name: string; description: string };
  onSubmit: (data: { name: string; description: string }) => void;
  onCancel: () => void;
  title: string;
}

export function DeckForm({ initialData, onSubmit, onCancel, title }: DeckFormProps) {
  const form = useForm<DeckFormData>({
    resolver: zodResolver(deckSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        description: initialData.description,
      });
    }
  }, [initialData, form]);

  const handleFormSubmit = (data: DeckFormData) => {
    onSubmit({
      name: data.name.trim(),
      description: data.description?.trim() || "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-2xl border border-border/80 animate-in zoom-in-95 duration-200">
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
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Deck Name
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="e.g. Spanish Vocabulary, AWS Cloud Practitioner"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={fieldState.invalid ? "name-error" : undefined}
                        className={fieldState.invalid ? "border-destructive focus-visible:ring-destructive/30" : ""}
                        autoFocus
                      />
                      <FieldError id="name-error" errors={[fieldState.error]} />
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
              Save Deck
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
