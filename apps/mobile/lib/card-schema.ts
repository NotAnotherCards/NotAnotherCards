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
    .min(1, 'mobile.messages.front_required')
    .max(CARD_SIDE_MAX_LENGTH, 'mobile.messages.front_max'),
  back: z
    .string()
    .trim()
    .min(1, 'mobile.messages.back_required')
    .max(CARD_SIDE_MAX_LENGTH, 'mobile.messages.back_max'),
});

export type CardFormValues = z.infer<typeof cardFormSchema>;
