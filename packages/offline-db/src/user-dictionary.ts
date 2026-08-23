import { z } from 'zod';
import { ModelFor, type InferRecord } from '@remelondb/core';
import { zodTable } from '@remelondb/core/zod';

export const UserDeckRow = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

export const UserCardRow = z.object({
  deck_id: z.string(),
  front: z.string(),
  back: z.string(),
  due_at: z.number().int().nonnegative(),
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
  indexed: ['deck_id', 'due_at', 'updated_at'],
});

export const reviewEvents = zodTable('review_events', ReviewEventRow, {
  indexed: ['user_card_id'],
});

export const userProfiles = zodTable('user_profiles', UserProfileRow, {
  indexed: ['updated_at'],
});

export class UserDeck extends ModelFor(userDecks) {
  static associations = {
    cards: { type: 'has_many' as const, foreignKey: 'deck_id' },
  };
}

export class UserCard extends ModelFor(userCards) {
  static associations = {
    deck: { type: 'belongs_to' as const, key: 'deck_id' },
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
export type UserCardRowType = z.infer<typeof UserCardRow>;
export type ReviewEventRowType = z.infer<typeof ReviewEventRow>;
export type UserProfileRowType = z.infer<typeof UserProfileRow>;

export type UserDeckRecord = InferRecord<typeof userDecks>;
export type UserCardRecord = InferRecord<typeof userCards>;
export type ReviewEventRecord = InferRecord<typeof reviewEvents>;
export type UserProfileRecord = InferRecord<typeof userProfiles>;
