import { z } from 'zod';
import { CARD_SIDE_MAX_LENGTH } from '@repo/schemas';

// The basic note: front and back, nothing else (#194 defines richer types).
// The shared CARD_SIDE_MAX_LENGTH, as web's CardForm and the AI parser use,
// so a typed card and a generated one obey the same bound. Trimmed before
// the check, so a whitespace-only side is rejected rather than saved blank.
export const cardFormSchema = z.object({
  front: z
    .string()
    .trim()
    .min(1, 'Front is required')
    .max(
      CARD_SIDE_MAX_LENGTH,
      `Front cannot exceed ${CARD_SIDE_MAX_LENGTH} characters`,
    ),
  back: z
    .string()
    .trim()
    .min(1, 'Back is required')
    .max(
      CARD_SIDE_MAX_LENGTH,
      `Back cannot exceed ${CARD_SIDE_MAX_LENGTH} characters`,
    ),
});

export type CardFormValues = z.infer<typeof cardFormSchema>;
