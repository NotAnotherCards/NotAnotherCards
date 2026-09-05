// src/lib/schemas/profile.ts
import { z } from 'zod';
export const userProfileFormSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens',
    ),
  native_language_id: z.string().min(1, 'Native language is required'),
  target_language_id: z.string().min(1, 'Target language is required'),
});
export type ProfileFormValues = z.infer<typeof userProfileFormSchema>;

// Placeholder ids until a languages table exists; the ids are what
// user_profiles stores, so web and mobile must share one list.
export const LANGUAGES = [
  { value: '00000000-0000-0000-0000-000000000001', label: '🇺🇸 English' },
  { value: '00000000-0000-0000-0000-000000000002', label: '🇪🇸 Spanish' },
  { value: '00000000-0000-0000-0000-000000000003', label: '🇩🇪 German' },
  { value: '00000000-0000-0000-0000-000000000004', label: '🇷🇺 Russian' },
] as const;

export const ENGLISH = LANGUAGES[0].value;
export const SPANISH = LANGUAGES[1].value;
export const GERMAN = LANGUAGES[2].value;
export const RUSSIAN = LANGUAGES[3].value;

/**
 * What a word's gender can be, per language a word note might be in.
 *
 * Each language's own notation. German and Spanish take the definite
 * article, which is the part a learner actually memorises. Russian has three
 * genders but no articles, so it takes the dictionary abbreviations a
 * learner meets there. English has no grammatical gender, so an empty list
 * means the field is not asked for at all.
 *
 * A language absent from this map is treated as English is: no field. The
 * note's `gender` stays free text in the registry, so this only decides
 * what the form offers.
 */
export const GENDERS_BY_LANGUAGE: Readonly<Record<string, readonly string[]>> =
  {
    [ENGLISH]: [],
    [SPANISH]: ['el', 'la'],
    [GERMAN]: ['der', 'die', 'das'],
    [RUSSIAN]: ['м.', 'ж.', 'ср.'],
  };

export function gendersFor(languageId: string | null | undefined) {
  return (languageId && GENDERS_BY_LANGUAGE[languageId]) || [];
}
