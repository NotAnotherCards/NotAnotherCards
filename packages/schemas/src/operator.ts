import { z } from 'zod';
import {
  deckReportResponseSchema,
  moderationClassifierResultSchema,
  sharedDeckSummarySchema,
} from './sharing.js';

export const operatorCapabilitiesSchema = z.object({
  canModerate: z.boolean(),
});
export const operatorDeckStatusSchema = z.enum([
  'visible',
  'blocked',
  'unavailable',
]);
const findingSchema = z.object({
  cardId: z.string(),
  reason: z.string(),
  classifier: z.string().optional(),
});
export const operatorModerationVerdictSchema = z.object({
  reason: z.string().optional(),
  flagged: z.array(findingSchema),
  warnings: z.array(findingSchema),
  // Older stored snapshots predate classifier auditing.
  results: z.array(moderationClassifierResultSchema).default([]),
});
const reviewedReportSchema = deckReportResponseSchema.shape.report.extend({
  publicationChanged: z.boolean().nullable(),
});

export const operatorReportPageSchema = z.object({
  reports: z.array(
    reviewedReportSchema.extend({
      title: z.string().nullable(),
      owner: z.object({ username: z.string() }).nullable(),
      status: operatorDeckStatusSchema,
      currentSnapshotPublishedAt: z.coerce.date().nullable(),
      moderationStatus: z.enum(['visible', 'blocked']).nullable(),
      moderationVerdict: operatorModerationVerdictSchema.nullable(),
      moderatedAt: z.coerce.date().nullable(),
    }),
  ),
});

// All rendered cards from the stored publication; never the private working copy
export const operatorDeckReviewSchema = z.object({
  deckId: z.string(),
  status: operatorDeckStatusSchema,
  reports: z.array(reviewedReportSchema),
  currentSnapshotPublishedAt: z.coerce.date().nullable(),
  moderatedAt: z.coerce.date().nullable(),
  moderationVerdict: operatorModerationVerdictSchema.nullable(),
  deck: sharedDeckSummarySchema
    .extend({
      // A retained snapshot may outlive the owner's public profile.
      owner: z.object({ username: z.string() }).nullable(),
      cards: z.array(
        z.object({ id: z.string(), front: z.string(), back: z.string() }),
      ),
    })
    .nullable(),
});

export const operatorTakedownRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  expectedPublishedAt: z.iso.datetime({ offset: true }),
});
export const operatorTakedownResponseSchema = z.object({
  status: z.literal('blocked'),
  snapshotPublishedAt: z.coerce.date(),
});
export const operatorTakedownErrorSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('PUBLICATION_CHANGED'),
    statusCode: z.literal(409),
    message: z.string(),
    currentSnapshotPublishedAt: z.coerce.date(),
  }),
  z.object({
    code: z.literal('PUBLICATION_UNAVAILABLE'),
    statusCode: z.literal(404),
    message: z.string(),
  }),
]);

export type OperatorCapabilities = z.infer<typeof operatorCapabilitiesSchema>;
export type OperatorReportPage = z.infer<typeof operatorReportPageSchema>;
export type OperatorDeckReview = z.infer<typeof operatorDeckReviewSchema>;
export type OperatorTakedownRequest = z.infer<
  typeof operatorTakedownRequestSchema
>;
export type OperatorTakedownResponse = z.infer<
  typeof operatorTakedownResponseSchema
>;
export type OperatorTakedownError = z.infer<typeof operatorTakedownErrorSchema>;
