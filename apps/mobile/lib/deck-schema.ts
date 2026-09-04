import { z } from 'zod';

// Same limits as web's DeckForm. Mobile-local until both clients can adopt one
// contract: web validates before trimming, so a whitespace-only title passes
// there and is rejected here.
export const deckFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Deck title is required')
    .max(100, 'Deck title cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters'),
});

export type DeckFormValues = z.infer<typeof deckFormSchema>;
