import { z } from 'zod';
import { DECK_NOTE_TYPES, WORD_NOTE_TYPE } from '@repo/offline-db';

// Same limits as web's DeckForm. Mobile-local until both clients can adopt one
// contract: web validates before trimming, so a whitespace-only title passes
// there and is rejected here.
export const deckFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Deck title is required')
      .max(100, 'Deck title cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters'),
    noteType: z.enum(DECK_NOTE_TYPES),
    nativeLanguageId: z.string(),
    targetLanguageId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.noteType !== WORD_NOTE_TYPE) return;
    for (const field of ['nativeLanguageId', 'targetLanguageId'] as const) {
      if (!values[field]) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'A word deck needs both languages',
        });
      }
    }
    if (
      values.nativeLanguageId &&
      values.nativeLanguageId === values.targetLanguageId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetLanguageId'],
        message: 'Choose a different target language',
      });
    }
  });

export type DeckFormValues = z.infer<typeof deckFormSchema>;
