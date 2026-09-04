/**
 * The note-type registry (#194): one entry per (note_type, fields_version)
 * pair, carrying the zod schema its fields_json must satisfy and the
 * templates that turn a note into its sibling cards.
 *
 * Everything derives from here: validateNoteFieldsJson (used by client row
 * validation and by the API's push cross-validation, so registering a type
 * hardens the sync protocol with no API change), and the reconcile step
 * that creates, updates and deactivates cards per template.
 */
import { z } from 'zod';
import {
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  WORD_NOTE_FIELDS_VERSION,
  WORD_NOTE_TYPE,
} from './note-constants.js';
import { BASIC_FRONT_BACK_TEMPLATE_KEY } from './ids.js';

export interface RenderedCard {
  readonly front: string;
  readonly back: string;
}

/**
 * One sibling card of a note type. `key` is half of the tuple hashed by
 * cardId, so it is a sync protocol constant: changing it re-derives a
 * different card id on every device (see ids.ts).
 *
 * The render contract: `front` is the complete question and `back` is the
 * answer content only, never restating the front — the review screen's
 * answer face composes front + divider + back itself, so a back that
 * repeats the front shows it twice.
 */
export interface NoteTemplate<Fields> {
  readonly key: string;
  readonly requires: (fields: Fields) => boolean;
  readonly render: (fields: Fields) => RenderedCard;
}

export interface RegisteredNoteType {
  readonly schema: z.ZodType;
  readonly templates: readonly NoteTemplate<unknown>[];
}

function defineNoteType<S extends z.ZodType>(
  schema: S,
  templates: readonly NoteTemplate<z.output<S>>[],
): RegisteredNoteType {
  // The one erasing cast: every caller parses fields with `schema` before
  // invoking a template, so what reaches requires/render is z.output<S>.
  return {
    schema,
    templates: templates as readonly NoteTemplate<unknown>[],
  };
}

export const BasicNoteFieldsV1 = z.strictObject({
  front: z.string(),
  back: z.string(),
});
export type BasicNoteFields = z.output<typeof BasicNoteFieldsV1>;

const requiredText = z.string().trim().min(1);
const optionalText = z.string().trim().min(1).optional();

/**
 * word@1, fields as agreed on #194: word in the target language,
 * translation in the native one; both language ids required and defaulted
 * from the profile by the forms; image and word_audio are reserved ids
 * into the future note_media table and cannot be filled yet.
 */
export const WordNoteFieldsV1 = z.strictObject({
  word: requiredText,
  translation: requiredText,
  native_language_id: z.string().min(1),
  target_language_id: z.string().min(1),
  example: optionalText,
  example_translation: optionalText,
  part_of_speech: optionalText,
  gender: optionalText,
  pronunciation: optionalText,
  image: z.string().min(1).optional(),
  word_audio: z.string().min(1).optional(),
  notes: optionalText,
});
export type WordNoteFields = z.output<typeof WordNoteFieldsV1>;

// Sync protocol constants, like BASIC_FRONT_BACK_TEMPLATE_KEY in ids.ts:
// each is half of the cardId tuple and must never change. Declared in
// #157's sibling order (word→translation, translation→word, listen,
// example) so a progressive-activation policy can later map onto the
// template list directly; `listen` joins when note_media exists.
export const WORD_TO_TRANSLATION_TEMPLATE_KEY = 'word-to-translation';
export const TRANSLATION_TO_WORD_TEMPLATE_KEY = 'translation-to-word';
export const EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY = 'example-to-translation';

const wordTemplates: readonly NoteTemplate<WordNoteFields>[] = [
  {
    key: WORD_TO_TRANSLATION_TEMPLATE_KEY,
    requires: () => true,
    render: (fields) => ({
      front: fields.part_of_speech
        ? `${fields.word} *(${fields.part_of_speech})*`
        : fields.word,
      back: fields.example
        ? `${fields.translation}\n\n${fields.example}`
        : fields.translation,
    }),
  },
  {
    key: TRANSLATION_TO_WORD_TEMPLATE_KEY,
    requires: () => true,
    render: (fields) => ({
      front: fields.translation,
      back: fields.word,
    }),
  },
  {
    key: EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY,
    requires: (fields) =>
      fields.example !== undefined && fields.example_translation !== undefined,
    render: (fields) => ({
      front: fields.example ?? '',
      back: fields.example_translation ?? '',
    }),
  },
];

export const noteTypeRegistry: Readonly<
  Record<string, Readonly<Record<number, RegisteredNoteType>>>
> = {
  [BASIC_NOTE_TYPE]: {
    [BASIC_NOTE_FIELDS_VERSION]: defineNoteType(BasicNoteFieldsV1, [
      {
        key: BASIC_FRONT_BACK_TEMPLATE_KEY,
        requires: () => true,
        render: (fields) => ({ front: fields.front, back: fields.back }),
      },
    ]),
  },
  [WORD_NOTE_TYPE]: {
    [WORD_NOTE_FIELDS_VERSION]: defineNoteType(WordNoteFieldsV1, wordTemplates),
  },
};

/** The per-type fields validators, derived from the registry. */
export const noteFieldsSchemas: Readonly<
  Record<string, Readonly<Record<number, z.ZodType>>>
> = Object.fromEntries(
  Object.entries(noteTypeRegistry).map(([type, versions]) => [
    type,
    Object.fromEntries(
      Object.entries(versions).map(([version, entry]) => [
        version,
        entry.schema,
      ]),
    ),
  ]),
);

export type NoteFieldsValidationResult =
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly error: string };

/** Validate a serialized note payload using its explicit type/version pair. */
export function validateNoteFieldsJson(
  noteType: string,
  fieldsVersion: number,
  fieldsJson: string,
): NoteFieldsValidationResult {
  const fieldsSchema = noteFieldsSchemas[noteType]?.[fieldsVersion];
  if (!fieldsSchema) {
    return {
      success: false,
      error: `Unsupported note fields schema: ${noteType}@${fieldsVersion}`,
    };
  }

  let fields: unknown;
  try {
    fields = JSON.parse(fieldsJson) as unknown;
  } catch {
    return { success: false, error: 'fields_json must be valid JSON' };
  }

  const result = fieldsSchema.safeParse(fields);
  if (!result.success) {
    return {
      success: false,
      error: `fields_json does not match ${noteType}@${fieldsVersion}`,
    };
  }
  return { success: true, data: result.data };
}
