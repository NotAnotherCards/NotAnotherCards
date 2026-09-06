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
/**
 * One row per language, holding everything about it: the id a profile and a
 * deck store, the name a prompt or a screen reader wants, the flag a picker
 * shows, and what a word's gender can be in it.
 *
 * The ids are placeholders until a languages table exists, and are what
 * `user_profiles` and `user_decks` store, so web, mobile and the api must
 * share this one list.
 *
 * Genders use each language's own notation. German and Spanish take the
 * definite article, which is the part a learner actually memorises. Russian
 * has three genders but no articles, so it takes the dictionary
 * abbreviations. English has none, and an empty list means a form does not
 * ask for the field at all.
 */
export const LANGUAGES = [
  {
    value: '00000000-0000-0000-0000-000000000001',
    name: 'English',
    flag: '🇺🇸',
    genders: [],
  },
  {
    value: '00000000-0000-0000-0000-000000000002',
    name: 'Spanish',
    flag: '🇪🇸',
    genders: ['el', 'la'],
  },
  {
    value: '00000000-0000-0000-0000-000000000003',
    name: 'German',
    flag: '🇩🇪',
    genders: ['der', 'die', 'das'],
  },
  {
    value: '00000000-0000-0000-0000-000000000004',
    name: 'Russian',
    flag: '🇷🇺',
    genders: ['м.', 'ж.', 'ср.'],
  },
] as const;

export type Language = (typeof LANGUAGES)[number];

export const ENGLISH = LANGUAGES[0].value;
export const SPANISH = LANGUAGES[1].value;
export const GERMAN = LANGUAGES[2].value;
export const RUSSIAN = LANGUAGES[3].value;

export function languageFor(
  languageId: string | null | undefined,
): Language | undefined {
  return LANGUAGES.find((language) => language.value === languageId);
}

/** Flag and name, for a picker. Prompts want `name` on its own. */
export function languageLabel(language: Language): string {
  return `${language.flag} ${language.name}`;
}

export function gendersFor(
  languageId: string | null | undefined,
): readonly string[] {
  return languageFor(languageId)?.genders ?? [];
}
