import { z } from 'zod';
import { CARD_SIDE_MAX_LENGTH } from './card.js';

// User-facing AI model aliases. The gateway maps these to provider model IDs
// (Groq primary, OpenRouter fallback) in its provider-profile config. The
// alias contract is stable across provider changes.
export const AI_MODELS = ['fast', 'balanced', 'smart'] as const;
export type AiModel = (typeof AI_MODELS)[number];

export const MODEL_LABELS: Record<AiModel, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  smart: 'Smart',
};

export const SELECTABLE_AI_MODELS = AI_MODELS;

export const quotaStatusSchema = z.object({
  usedTokens: z.number().int().nonnegative(),
  maxTokens: z.number().int().positive(),
  requestsUsed: z.number().int().nonnegative(),
  maxRequests: z.number().int().positive(),
  activePendingJobs: z.number().int().nonnegative(),
  maxPendingJobs: z.number().int().positive(),
});

export type QuotaStatus = z.infer<typeof quotaStatusSchema>;

const model = z.enum(AI_MODELS).optional();
const count = z.number().int().min(1).max(20).default(5);

export const createAiJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('topic_deck'),
    topic: z
      .string()
      .trim()
      .min(1, 'ai.validation.topic_empty')
      .max(300, 'ai.validation.topic_too_long'),
    count,
    model,
  }),
  z.object({
    type: z.literal('text_cards'),
    sourceText: z
      .string()
      .trim()
      .min(1, 'ai.validation.source_text_empty')
      .max(10000, 'ai.validation.source_text_too_long'),
    count,
    model,
  }),
  z.object({
    type: z.literal('word_note'),
    deckId: z.string(),
    word: z.string().trim().min(1).max(100),
    direction: z.enum(['target', 'native']),
    model,
  }),
]);

export type CreateAiJobInput = z.infer<typeof createAiJobSchema>;

export const aiCardOutputSchema = z.object({
  front: z.string().min(1).max(CARD_SIDE_MAX_LENGTH),
  back: z.string().min(1).max(CARD_SIDE_MAX_LENGTH),
});

export type AiCardOutput = z.infer<typeof aiCardOutputSchema>;

export const aiWordNoteCandidateSchema = z.object({
  noteType: z.literal('word'),
  fieldsVersion: z.literal(1),
  fields: z.object({
    word: z.string(),
    translation: z.string(),
    native_language_id: z.string(),
    target_language_id: z.string(),
    part_of_speech: z.string(),
    example: z.string(),
    example_translation: z.string(),
    pronunciation: z.string(),
    gender: z.string().optional(),
  }),
});
export type AiWordNoteCandidate = z.infer<typeof aiWordNoteCandidateSchema>;

export const topicDeckPayloadSchema = z.object({
  topic: z.string(),
  count: z.number(),
  model: z.string().optional(),
});
export type TopicDeckPayload = z.infer<typeof topicDeckPayloadSchema>;

export const textCardsPayloadSchema = z.object({
  sourceText: z.string(),
  count: z.number(),
  model: z.string().optional(),
});
export type TextCardsPayload = z.infer<typeof textCardsPayloadSchema>;

export const wordNotePayloadSchema = z.object({
  deckId: z.string(),
  word: z.string(),
  direction: z.enum(['target', 'native']),
  nativeLanguageId: z.string(),
  nativeLanguageName: z.string(),
  targetLanguageId: z.string(),
  targetLanguageName: z.string(),
  model: z.string().optional(),
});
export type WordNotePayload = z.infer<typeof wordNotePayloadSchema>;

export const aiJobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);
export type AiJobStatus = z.infer<typeof aiJobStatusSchema>;

/**
 * The job shape the API returns to clients. Server-side rows carry more
 * columns (attempts, lock and retry timestamps); parsing strips them, so
 * this stays the contract the UI reads.
 */
const aiJobFields = {
  id: z.string(),
  status: aiJobStatusSchema,
  error: z.string().nullish(),
  createdAt: z.string(),
};

export const aiJobSchema = z.discriminatedUnion('type', [
  z.object({
    ...aiJobFields,
    type: z.literal('topic_deck'),
    payload: topicDeckPayloadSchema,
    result: z.array(aiCardOutputSchema).nullish(),
  }),
  z.object({
    ...aiJobFields,
    type: z.literal('text_cards'),
    payload: textCardsPayloadSchema,
    result: z.array(aiCardOutputSchema).nullish(),
  }),
  z.object({
    ...aiJobFields,
    type: z.literal('word_note'),
    payload: wordNotePayloadSchema,
    result: aiWordNoteCandidateSchema.nullish(),
  }),
]);
export type AiJob = z.infer<typeof aiJobSchema>;

/** Response envelopes of the AI endpoints, parsed by the clients. */
export const aiJobResponseSchema = z.object({ job: aiJobSchema });
// A job this client cannot read (a type or fields version from a newer
// server) must not take the whole list down with it: that row is skipped.
export const aiJobsResponseSchema = z.object({
  jobs: z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row) => {
      const parsed = aiJobSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
});
export const aiQuotaResponseSchema = z.object({ quota: quotaStatusSchema });

/** Playground transport reuses the same card contract as completed jobs. */
export const aiPlaygroundEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), delta: z.string() }),
  z.object({ type: z.literal('result'), cards: z.array(aiCardOutputSchema) }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type AiPlaygroundEvent = z.infer<typeof aiPlaygroundEventSchema>;
