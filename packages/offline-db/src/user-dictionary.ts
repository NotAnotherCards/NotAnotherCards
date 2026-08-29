import { z } from 'zod';
import { ModelFor, type InferRecord } from '@remelondb/core';
import { zodTable } from '@remelondb/core/zod';

export const BasicNoteFieldsV1 = z.strictObject({
  front: z.string(),
  back: z.string(),
});

// The word-note payload is intentionally open while the exact v1 content
// shape is still being discussed in #157
export const WordNoteFieldsV1 = z.looseObject({
  original_language: z.string().min(1),
  translation_language: z.string().min(1),
});

export const noteFieldsSchemas: Readonly<
  Record<string, Readonly<Record<number, z.ZodType>>>
> = {
  basic: { 1: BasicNoteFieldsV1 },
  word: { 1: WordNoteFieldsV1 },
};

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

export const UserDeckRow = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

export const UserCardRow = z.object({
  note_id: z.string().min(1),
  template_key: z.string().min(1),
  active: z.boolean(),
  front: z.string(),
  back: z.string(),
  due_at: z.number().int().nonnegative(),
  scheduled_interval_minutes: z.number().int().min(0),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

export const UserNoteRow = z
  .object({
    note_type: z.string().min(1),
    fields_version: z.number().int().positive(),
    fields_json: z.string(),
    additional_content: z.string().nullable(),
    created_at: z.number().int().nonnegative(),
    updated_at: z.number().int().nonnegative(),
  })
  .superRefine((row, context) => {
    const result = validateNoteFieldsJson(
      row.note_type,
      row.fields_version,
      row.fields_json,
    );
    if (!result.success) {
      context.addIssue({
        code: 'custom',
        path: ['fields_json'],
        message: result.error,
      });
    }
  });

export const UserNoteDeckRow = z.object({
  note_id: z.string().min(1),
  deck_id: z.string().min(1),
  active: z.boolean(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

export const ReviewEventRow = z.object({
  user_card_id: z.string(),
  rating: z.number().int().min(1).max(4),
  reviewed_at: z.number().int().nonnegative(),
});

export const UserProfileRow = z.object({
  username: z.string().nullable(),
  bio: z.string().nullable(),
  avatar_file_id: z.string().nullable(),
  native_language_id: z.string().nullable(),
  target_language_id: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

export const userDecks = zodTable('user_decks', UserDeckRow, {
  indexed: ['updated_at'],
});

export const userCards = zodTable('user_cards', UserCardRow, {
  indexed: ['note_id', 'due_at', 'updated_at'],
});

export const userNotes = zodTable('user_notes', UserNoteRow, {
  indexed: ['updated_at'],
});

export const userNoteDecks = zodTable('user_note_decks', UserNoteDeckRow, {
  indexed: ['note_id', 'deck_id', 'updated_at'],
});

export const reviewEvents = zodTable('review_events', ReviewEventRow, {
  indexed: ['user_card_id'],
});

export const userProfiles = zodTable('user_profiles', UserProfileRow, {
  indexed: ['updated_at'],
});

export class UserDeck extends ModelFor(userDecks) {
  static associations = {
    note_decks: { type: 'has_many' as const, foreignKey: 'deck_id' },
  };
}

export class UserNote extends ModelFor(userNotes) {
  static associations = {
    cards: { type: 'has_many' as const, foreignKey: 'note_id' },
    note_decks: { type: 'has_many' as const, foreignKey: 'note_id' },
  };
}

export class UserNoteDeck extends ModelFor(userNoteDecks) {
  static associations = {
    note: { type: 'belongs_to' as const, key: 'note_id' },
    deck: { type: 'belongs_to' as const, key: 'deck_id' },
  };
}

export class UserCard extends ModelFor(userCards) {
  static associations = {
    note: { type: 'belongs_to' as const, key: 'note_id' },
    review_events: { type: 'has_many' as const, foreignKey: 'user_card_id' },
  };
}

export class ReviewEvent extends ModelFor(reviewEvents) {
  static associations = {
    user_card: { type: 'belongs_to' as const, key: 'user_card_id' },
  };
}

export class UserProfile extends ModelFor(userProfiles) {}

export type UserDeckRowType = z.infer<typeof UserDeckRow>;
export type UserNoteRowType = z.infer<typeof UserNoteRow>;
export type UserNoteDeckRowType = z.infer<typeof UserNoteDeckRow>;
export type UserCardRowType = z.infer<typeof UserCardRow>;
export type ReviewEventRowType = z.infer<typeof ReviewEventRow>;
export type UserProfileRowType = z.infer<typeof UserProfileRow>;

export type UserDeckRecord = InferRecord<typeof userDecks>;
export type UserNoteRecord = InferRecord<typeof userNotes>;
export type UserNoteDeckRecord = InferRecord<typeof userNoteDecks>;
export type UserCardRecord = InferRecord<typeof userCards>;
export type ReviewEventRecord = InferRecord<typeof reviewEvents>;
export type UserProfileRecord = InferRecord<typeof userProfiles>;
