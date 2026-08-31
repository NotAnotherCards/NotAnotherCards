import { z } from 'zod';

export const AI_MODELS = ['qwen', 'qwen-next-80b', 'mistral-small'] as const;
export type AiModel = (typeof AI_MODELS)[number];

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
