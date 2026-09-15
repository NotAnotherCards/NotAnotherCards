import { z } from 'zod';

export const badgeCodeSchema = z.enum([
  'first-review',
  'seven-day-streak',
  'hundred-reviews',
]);

export const dailyChallengeCodeSchema = z.enum([
  'daily-review',
  'new-vocabulary',
]);

export const gamificationMeSchema = z.object({
  utcDate: z.iso.date(),
  points: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  learnedNoteCount: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  badges: z.array(
    z.object({
      code: badgeCodeSchema,
      awardedAt: z.number().int().nonnegative(),
    }),
  ),
  dailyChallenges: z.array(
    z.object({
      code: dailyChallengeCodeSchema,
      current: z.number().int().nonnegative(),
      target: z.number().int().positive(),
      completed: z.boolean(),
      completedAt: z.number().int().nonnegative().nullable(),
    }),
  ),
});

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  username: z.string(),
  points: z.number().int().nonnegative(),
  isCurrentUser: z.boolean(),
});

export const gamificationLeaderboardSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  currentUser: leaderboardEntrySchema.nullable(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type GamificationMe = z.infer<typeof gamificationMeSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type GamificationLeaderboard = z.infer<
  typeof gamificationLeaderboardSchema
>;
