import { z } from 'zod';

/**
 * One row of GET /api/shared/decks, and the deck half of a preview.
 *
 * `owner.username` is null when the owner never finished onboarding: the deck
 * is still listed, so the clients need something to show in its place.
 */
export const sharedDeckSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  noteType: z.string(),
  nativeLanguageId: z.uuid().nullable(),
  targetLanguageId: z.uuid().nullable(),
  cardCount: z.number().int().nonnegative(),
  owner: z.object({ username: z.string().nullable() }),
  updatedAt: z.number(),
});

export const sharedDeckListSchema = z.object({
  decks: z.array(sharedDeckSummarySchema),
});

/** Preview cards are text only; media stays behind the file ids nothing serves. */
export const sharedDeckPreviewSchema = z.object({
  deck: sharedDeckSummarySchema.extend({
    cards: z.array(z.object({ front: z.string(), back: z.string() })),
  }),
});

/**
 * The 422 body a publish gets back when moderation refuses. Either the whole
 * deck was refused, with `reason`, or individual cards were, in `flagged`.
 */
export const moderationRefusalSchema = z.object({
  reason: z.string().optional(),
  flagged: z.array(z.object({ cardId: z.string(), reason: z.string() })),
});

export type SharedDeckSummary = z.infer<typeof sharedDeckSummarySchema>;
export type SharedDeckList = z.infer<typeof sharedDeckListSchema>;
export type SharedDeckPreview = z.infer<typeof sharedDeckPreviewSchema>;
export type ModerationRefusal = z.infer<typeof moderationRefusalSchema>;
