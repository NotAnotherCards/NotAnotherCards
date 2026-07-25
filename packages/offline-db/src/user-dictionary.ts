import { z } from "zod";
import { ModelFor, type InferRecord } from "@remelondb/core";
import { zodTable } from "@remelondb/core/zod";

export const UserCardRow = z.object({
  user_id: z.string(),
  card_id: z.string(),
  status: z.string().default("learning"), // new | learning | learned | suspended | archived
  source: z.string().default("manual"), // manual | collection | ai | imported
  offline_enabled: z.boolean().default(false),
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

export const userCards = zodTable("user_cards", UserCardRow, {
  indexed: ["user_id", "card_id"],
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

export class UserCard extends ModelFor(userCards) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
    card: { type: "belongs_to" as const, key: "card_id" },
    overrides: { type: "has_many" as const, foreignKey: "user_card_id" },
    notes: { type: "has_many" as const, foreignKey: "user_card_id" },
    reset_events: { type: "has_many" as const, foreignKey: "user_card_id" },
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

export type UserCardRowType = z.infer<typeof UserCardRow>;
export type UserCardOverrideRowType = z.infer<typeof UserCardOverrideRow>;
export type UserCardNoteRowType = z.infer<typeof UserCardNoteRow>;
export type UserCardResetEventRowType = z.infer<typeof UserCardResetEventRow>;

export type UserCardRecord = InferRecord<typeof userCards>;
export type UserCardOverrideRecord = InferRecord<typeof userCardOverrides>;
export type UserCardNoteRecord = InferRecord<typeof userCardNotes>;
export type UserCardResetEventRecord = InferRecord<typeof userCardResetEvents>;
