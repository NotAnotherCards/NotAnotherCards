import { z } from 'zod';

// Gateway aliases (infra/gx10/litellm-config.yaml). 'qwen' is the deprecated
// name for 'qwen3.6', kept for clients that still send the legacy alias.
export const AI_MODELS = [
  'gemma4',
  'qwen3.6',
  'qwen',
  'qwen-next-80b',
  'qwen3.8',
  'muse-glimmer',
  'mistral-small',
] as const;
export type AiModel = (typeof AI_MODELS)[number];

export const MODEL_LABELS: Record<AiModel, string> = {
  gemma4: 'Gemma 4 (Default)',
  'qwen3.6': 'Qwen 3.6',
  qwen: 'Qwen (Deprecated)',
  'qwen-next-80b': 'Qwen Next 80B (Smart)',
  'qwen3.8': 'Qwen 3.8',
  'muse-glimmer': 'Muse Glimmer',
  'mistral-small': 'Mistral Small',
};

export const SELECTABLE_AI_MODELS = AI_MODELS.filter(
  (m): m is Exclude<AiModel, 'qwen'> => m !== 'qwen',
);

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
      .min(1, 'Topic cannot be empty')
      .max(300, 'Topic is too long'),
    count,
    model,
  }),
  z.object({
    type: z.literal('text_cards'),
    sourceText: z
      .string()
      .trim()
      .min(1, 'Source text cannot be empty')
      .max(10000, 'Source text cannot exceed 10000 characters'),
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
  front: z.string().min(1).max(1000),
  back: z.string().min(1).max(1000),
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
