import { z } from "zod";
import { ModelFor, type InferRecord } from "@remelondb/core";
import { zodTable } from "@remelondb/core/zod";

export const UserDeckRow = z.object({
  user_id: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  deleted_at: z.number().nullable(),
});

export const UserCardRow = z.object({
  user_id: z.string(),
  deck_id: z.string(),
  front: z.string(),
  back: z.string(),
  due_at: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
  deleted_at: z.number().nullable(),
});

export const ReviewEventRow = z.object({
  user_id: z.string(),
  user_card_id: z.string(),
  rating: z.number().int().min(1).max(4),
  reviewed_at: z.number(),
});

export const userDecks = zodTable("user_decks", UserDeckRow, {
  indexed: ["user_id", "updated_at"],
});

export const userCards = zodTable("user_cards", UserCardRow, {
  indexed: ["user_id", "deck_id", "due_at", "updated_at"],
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
    deck: { type: "belongs_to" as const, key: "deck_id" },
    review_events: { type: "has_many" as const, foreignKey: "user_card_id" },
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
export type ReviewEventRowType = z.infer<typeof ReviewEventRow>;

export type UserDeckRecord = InferRecord<typeof userDecks>;
export type UserCardRecord = InferRecord<typeof userCards>;
export type ReviewEventRecord = InferRecord<typeof reviewEvents>;
