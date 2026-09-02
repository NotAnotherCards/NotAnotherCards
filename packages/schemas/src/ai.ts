import { z } from 'zod';

// Gateway aliases (infra/gx10/litellm-config.yaml). 'qwen' is the deprecated
// name for 'qwen3.6', kept until production sends the new one (#193).
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

export const createAiJobSchema = z
  .object({
    type: z.enum(['topic_deck', 'text_cards']),
    topic: z
      .string()
      .trim()
      .min(1, 'Topic cannot be empty')
      .max(300, 'Topic is too long')
      .optional(),
    sourceText: z
      .string()
      .trim()
      .min(1, 'Source text cannot be empty')
      .max(10000, 'Source text cannot exceed 10000 characters')
      .optional(),
    count: z.number().int().min(1).max(20).default(5),
    model: z.enum(AI_MODELS).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'topic_deck' && !data.topic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Topic is required for topic_deck generation',
        path: ['topic'],
      });
    }
    if (data.type === 'text_cards' && !data.sourceText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source text is required for text_cards generation',
        path: ['sourceText'],
      });
    }
  });

export type CreateAiJobInput = z.infer<typeof createAiJobSchema>;

export const aiCardOutputSchema = z.object({
  front: z.string().min(1).max(1000),
  back: z.string().min(1).max(1000),
});

export type AiCardOutput = z.infer<typeof aiCardOutputSchema>;
