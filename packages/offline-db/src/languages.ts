import { z } from "zod";
import { ModelFor, type InferRecord } from "@remelondb/core";
import { zodTable } from "@remelondb/core/zod";

export const LanguageRow = z.object({
  code: z.string(), // e.g. "en", "de"
  name: z.string(), // e.g. "English"
  native_name: z.string().nullable(),
  direction: z.string(),
  created_at: z.number(),
});

export const UserLearningLanguageRow = z.object({
  user_id: z.string(),
  language_id: z.string(),
  is_primary: z.boolean(),
  created_at: z.number(),
});

export const languages = zodTable("languages", LanguageRow, {
  indexed: ["code"],
});

export const userLearningLanguages = zodTable("user_learning_languages", UserLearningLanguageRow, {
  indexed: ["user_id", "language_id"],
});

export class Language extends ModelFor(languages) {
  static associations = {
    learning_users: { type: "has_many" as const, foreignKey: "language_id" },
  };
}

export class UserLearningLanguage extends ModelFor(userLearningLanguages) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
    language: { type: "belongs_to" as const, key: "language_id" },
  };
}

export type LanguageRowType = z.infer<typeof LanguageRow>;
export type UserLearningLanguageRowType = z.infer<typeof UserLearningLanguageRow>;

export type LanguageRecord = InferRecord<typeof languages>;
export type UserLearningLanguageRecord = InferRecord<typeof userLearningLanguages>;
