import { z } from 'zod';
import { CARD_FACE_MAX_LENGTH } from '@repo/schemas';

// The basic note: front and back, nothing else (#194 defines richer types).
// Shared with web, AI generation, and sync so every creation path obeys the
// review-safe bound. Trim before checking so whitespace is not saved blank.
export const cardFormSchema = z.object({
  front: z
    .string()
    .trim()
    .min(1, 'Front is required')
    .max(
      CARD_FACE_MAX_LENGTH,
      `Front cannot exceed ${CARD_FACE_MAX_LENGTH} characters`,
    ),
  back: z
    .string()
    .trim()
    .min(1, 'Back is required')
    .max(
      CARD_FACE_MAX_LENGTH,
      `Back cannot exceed ${CARD_FACE_MAX_LENGTH} characters`,
    ),
});

export type CardFormValues = z.infer<typeof cardFormSchema>;
