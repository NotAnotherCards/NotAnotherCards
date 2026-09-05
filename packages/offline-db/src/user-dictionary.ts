import { z } from 'zod';
import { ModelFor, type InferRecord } from '@remelondb/core';
import { zodTable } from '@remelondb/core/zod';
import { refineNoteFields } from './note-registry.js';
import { REVIEW_INTERVAL_CAP_MINUTES } from './review-scheduler.js';

export const UserDeckRow = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  // Which note contract this deck's notes follow. Left unrefined on
  // purpose: a deck type this client does not know is stored and synced
  // opaquely rather than rejected on pull, the same forward compatibility
  // #194 gave unknown note types. The known set is checked server-side.
  note_type: z.string().min(1),
  // Defaults a word deck's note form starts from. The note stays the
  // canonical source of its own languages; these only prefill.
  native_language_id: z.string().nullable(),
  target_language_id: z.string().nullable(),
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
  scheduled_interval_minutes: z
    .number()
    .int()
    .min(0)
    .max(REVIEW_INTERVAL_CAP_MINUTES),
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
  .superRefine(refineNoteFields);

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
