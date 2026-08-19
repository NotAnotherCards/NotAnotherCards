// src/lib/schemas/profile.ts
import { z } from "zod";
export const userProfileFormSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),
  native_language_id: z.string().min(1, "Native language is required"),
  target_language_id: z.string().min(1, "Target language is required"),
});
export type ProfileFormValues = z.infer<typeof userProfileFormSchema>;
