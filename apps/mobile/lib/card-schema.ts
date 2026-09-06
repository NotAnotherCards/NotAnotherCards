import { z } from 'zod';

// The basic note: front and back, nothing else (#194 defines richer types).
// Same limits as web's CardForm and as the AI parser's slice(0, 1000), so a
// typed card and a generated one obey the same bound. Trimmed before the
// check, so a whitespace-only side is rejected rather than saved blank.
export const cardFormSchema = z.object({
  front: z
    .string()
    .trim()
    .min(1, 'Front is required')
    .max(1000, 'Front cannot exceed 1000 characters'),
  back: z
    .string()
    .trim()
    .min(1, 'Back is required')
    .max(1000, 'Back cannot exceed 1000 characters'),
});

export type CardFormValues = z.infer<typeof cardFormSchema>;
