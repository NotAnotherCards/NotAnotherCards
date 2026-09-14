import { z } from 'zod';

/**
 * One row of GET /api/shared/decks, and the deck half of a preview.
 *
 * `owner.username` is always set: only onboarded users can publish, and
 * onboarding sets the username.
 */
export const sharedDeckSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  noteType: z.string(),
  // Plain strings, as in user-profile.ts: the language ids are fixed
  // sentinels that z.uuid() rejects.
  nativeLanguageId: z.string().nullable(),
  targetLanguageId: z.string().nullable(),
  cardCount: z.number().int().nonnegative(),
  owner: z.object({ username: z.string() }),
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

export const moderationWarningSchema = z.object({
  cardId: z.string(),
  reason: z.string(),
});

export const moderationClassifierResultSchema = z.object({
  cardId: z.string(),
  classifier: z.string(),
  verdict: z.enum(['safe', 'unsafe', 'controversial', 'error']),
  categories: z.array(z.string()).nullable(),
  error: z.string().optional(),
});

export const publishResponseSchema = z.object({
  visibility: z.literal('public'),
  warnings: z.array(moderationWarningSchema),
});

export type SharedDeckSummary = z.infer<typeof sharedDeckSummarySchema>;
export type SharedDeckList = z.infer<typeof sharedDeckListSchema>;
export type SharedDeckPreview = z.infer<typeof sharedDeckPreviewSchema>;
export type ModerationRefusal = z.infer<typeof moderationRefusalSchema>;
export type ModerationWarning = z.infer<typeof moderationWarningSchema>;
export type ModerationClassifierResult = z.infer<
  typeof moderationClassifierResultSchema
>;
export type PublishResponse = z.infer<typeof publishResponseSchema>;

export const moderationExplanationRequestSchema = z.object({
  cardId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
  source: z.enum(['working', 'published']),
});

export const moderationExplanationEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), delta: z.string() }),
  z.object({ type: z.literal('result'), explanation: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type ModerationExplanationRequest = z.infer<
  typeof moderationExplanationRequestSchema
>;
export type ModerationExplanationEvent = z.infer<
  typeof moderationExplanationEventSchema
>;

export const sharedDeckImportSchema = z.object({ deckId: z.string() });
export type SharedDeckImport = z.infer<typeof sharedDeckImportSchema>;

export const deckReportResponseSchema = z.object({
  report: z.object({
    id: z.string(),
    deckId: z.string(),
    reporterUserId: z.string(),
    reason: z.string(),
    snapshotPublishedAt: z.coerce.date(),
    createdAt: z.coerce.date(),
  }),
  recheck: z.enum(['queued', 'pending', 'cached']),
});

export const ownerModerationStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('clear') }),
  z.object({
    status: z.literal('visible'),
    warnings: z.array(
      z.object({
        cardId: z.string(),
        reason: z.string(),
        classifier: z.string().optional(),
      }),
    ),
  }),
  z.object({
    status: z.literal('blocked'),
    reason: z.string().optional(),
    flagged: z.array(
      z.object({
        cardId: z.string(),
        reason: z.string(),
        classifier: z.string().optional(),
      }),
    ),
    warnings: z.array(
      z.object({
        cardId: z.string(),
        reason: z.string(),
        classifier: z.string().optional(),
      }),
    ),
    results: z.array(moderationClassifierResultSchema),
    moderatedAt: z.coerce.date().nullable(),
  }),
]);

export type DeckReportResponse = z.infer<typeof deckReportResponseSchema>;
export type OwnerModerationStatus = z.infer<typeof ownerModerationStatusSchema>;
