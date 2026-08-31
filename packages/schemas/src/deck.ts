import { z } from 'zod';

// Deck title and description limits, shared by the web and mobile forms.
export const deckFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Deck title is required')
    .max(100, 'Deck title cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

export type DeckFormValues = z.infer<typeof deckFormSchema>;
