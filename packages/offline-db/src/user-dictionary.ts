import { z } from "zod";
import { ModelFor, type InferRecord } from "@remelondb/core";
import { zodTable } from "@remelondb/core/zod";

export const UserDeckRow = z.object({
  user_id: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const UserCardRow = z.object({
  user_id: z.string(),
  card_id: z.string(),
  deck_id: z.string().nullable(),
  status: z.string(), // new | learning | learned | suspended | archived
  source: z.string(), // manual | collection | ai | imported
  offline_enabled: z.boolean(),
  due_at: z.number().nullable(),
  added_at: z.number(),
  updated_at: z.number(),
});

export const UserCardOverrideRow = z.object({
  user_card_id: z.string(),
  field_path: z.string(), // "translation", "mnemonic", "examples[0].text"
  value: z.string(), // JSON string representing overridden value
  created_at: z.number(),
  updated_at: z.number(),
});

export const UserCardNoteRow = z.object({
  user_card_id: z.string(),
  note: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const UserCardResetEventRow = z.object({
  user_card_id: z.string(),
  reason: z.string().nullable(),
  created_at: z.number(),
});

export const ReviewEventRow = z.object({
  user_id: z.string(),
  user_card_id: z.string(),
  rating: z.number().int(), // e.g. 1 = again, 2 = hard, 3 = good, 4 = easy
  ease_factor: z.number(),
  interval: z.number().int(),
  reviewed_at: z.number(),
  created_at: z.number(),
});

export const userDecks = zodTable("user_decks", UserDeckRow, {
  indexed: ["user_id", "updated_at"],
});

export const userCards = zodTable("user_cards", UserCardRow, {
  indexed: ["user_id", "card_id", "deck_id", "due_at", "updated_at"],
});

export const userCardOverrides = zodTable("user_card_overrides", UserCardOverrideRow, {
  indexed: ["user_card_id"],
});

export const userCardNotes = zodTable("user_card_notes", UserCardNoteRow, {
  indexed: ["user_card_id"],
});

export const userCardResetEvents = zodTable("user_card_reset_events", UserCardResetEventRow, {
  indexed: ["user_card_id"],
});

export const reviewEvents = zodTable("review_events", ReviewEventRow, {
  indexed: ["user_id", "user_card_id"],
});

export class UserDeck extends ModelFor(userDecks) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
    cards: { type: "has_many" as const, foreignKey: "deck_id" },
  };
}

export class UserCard extends ModelFor(userCards) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
    card: { type: "belongs_to" as const, key: "card_id" },
    deck: { type: "belongs_to" as const, key: "deck_id" },
    overrides: { type: "has_many" as const, foreignKey: "user_card_id" },
    notes: { type: "has_many" as const, foreignKey: "user_card_id" },
    reset_events: { type: "has_many" as const, foreignKey: "user_card_id" },
    review_events: { type: "has_many" as const, foreignKey: "user_card_id" },
  };
}

export class UserCardOverride extends ModelFor(userCardOverrides) {
  static associations = {
    user_card: { type: "belongs_to" as const, key: "user_card_id" },
  };
}

export class UserCardNote extends ModelFor(userCardNotes) {
  static associations = {
    user_card: { type: "belongs_to" as const, key: "user_card_id" },
  };
}

export class UserCardResetEvent extends ModelFor(userCardResetEvents) {
  static associations = {
    user_card: { type: "belongs_to" as const, key: "user_card_id" },
  };
}

export class ReviewEvent extends ModelFor(reviewEvents) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
    user_card: { type: "belongs_to" as const, key: "user_card_id" },
  };
}

export type UserDeckRowType = z.infer<typeof UserDeckRow>;
export type UserCardRowType = z.infer<typeof UserCardRow>;
export type UserCardOverrideRowType = z.infer<typeof UserCardOverrideRow>;
export type UserCardNoteRowType = z.infer<typeof UserCardNoteRow>;
export type UserCardResetEventRowType = z.infer<typeof UserCardResetEventRow>;
export type ReviewEventRowType = z.infer<typeof ReviewEventRow>;

export type UserDeckRecord = InferRecord<typeof userDecks>;
export type UserCardRecord = InferRecord<typeof userCards>;
export type UserCardOverrideRecord = InferRecord<typeof userCardOverrides>;
export type UserCardNoteRecord = InferRecord<typeof userCardNotes>;
export type UserCardResetEventRecord = InferRecord<typeof userCardResetEvents>;
export type ReviewEventRecord = InferRecord<typeof reviewEvents>;
