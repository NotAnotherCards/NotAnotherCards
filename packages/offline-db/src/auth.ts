import { z } from "zod";
import { ModelFor, type InferRecord } from "@remelondb/core";
import { zodTable } from "@remelondb/core/zod";

export const UserRow = z.object({
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string(),
  username: z.string(),
  timezone: z.string(),
  image: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  deleted_at: z.number().nullable(),
});

export const SessionRow = z.object({
  user_id: z.string(),
  token: z.string(),
  expires_at: z.number(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const AccountRow = z.object({
  user_id: z.string(),
  provider_id: z.string(),
  account_id: z.string(),
  access_token: z.string().nullable(),
  refresh_token: z.string().nullable(),
  id_token: z.string().nullable(),
  access_token_expires_at: z.number().nullable(),
  refresh_token_expires_at: z.number().nullable(),
  scope: z.string().nullable(),
  password: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const VerificationRow = z.object({
  identifier: z.string(),
  value: z.string(),
  expires_at: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const UserProfileRow = z.object({
  user_id: z.string(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  avatar_file_id: z.string().nullable(),
  native_language_id: z.string().nullable(),
  target_language_id: z.string().nullable(),
  timezone: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const UserSettingsRow = z.object({
  user_id: z.string(),
  theme: z.string(),
  ui_language: z.string(),
  daily_review_goal: z.number().int(),
  notifications_enabled: z.boolean(),
  sound_enabled: z.boolean(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const users = zodTable("users", UserRow, {
  indexed: ["username"],
});

export const sessions = zodTable("sessions", SessionRow, {
  indexed: ["user_id"],
});

export const accounts = zodTable("accounts", AccountRow, {
  indexed: ["user_id"],
});

export const verifications = zodTable("verifications", VerificationRow, {
  indexed: ["identifier"],
});

export const userProfiles = zodTable("user_profiles", UserProfileRow, {
  indexed: ["user_id"],
});

export const userSettings = zodTable("user_settings", UserSettingsRow, {
  indexed: ["user_id"],
});

export class User extends ModelFor(users) {
  static associations = {
    sessions: { type: "has_many" as const, foreignKey: "user_id" },
    accounts: { type: "has_many" as const, foreignKey: "user_id" },
  };
}

export class Session extends ModelFor(sessions) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
  };
}

export class Account extends ModelFor(accounts) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
  };
}

export class Verification extends ModelFor(verifications) {}

export class UserProfile extends ModelFor(userProfiles) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
  };
}

export class UserSettings extends ModelFor(userSettings) {
  static associations = {
    user: { type: "belongs_to" as const, key: "user_id" },
  };
}

export type UserRowType = z.infer<typeof UserRow>;
export type SessionRowType = z.infer<typeof SessionRow>;
export type AccountRowType = z.infer<typeof AccountRow>;
export type VerificationRowType = z.infer<typeof VerificationRow>;
export type UserProfileRowType = z.infer<typeof UserProfileRow>;
export type UserSettingsRowType = z.infer<typeof UserSettingsRow>;

export type UserRecord = InferRecord<typeof users>;
export type SessionRecord = InferRecord<typeof sessions>;
export type AccountRecord = InferRecord<typeof accounts>;
export type VerificationRecord = InferRecord<typeof verifications>;
export type UserProfileRecord = InferRecord<typeof userProfiles>;
export type UserSettingsRecord = InferRecord<typeof userSettings>;
