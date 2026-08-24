import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { user } from '../database/schema';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobType = 'topic_deck' | 'text_cards';

export interface CardOutput {
  front: string;
  back: string;
}

export interface DeckGenerationPayload {
  topic?: string;
  sourceText?: string;
  count: number;
  model?: string;
}

export const aiGenerationJobs = pgTable(
  'ai_generation_jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').$type<JobType>().notNull(),
    status: text('status').$type<JobStatus>().default('pending').notNull(),
    payload: jsonb('payload').$type<DeckGenerationPayload>().notNull(),
    result: jsonb('result').$type<CardOutput[]>(),
    error: text('error'),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('ai_jobs_user_status_idx').on(table.userId, table.status),
    index('ai_jobs_status_attempts_idx').on(table.status, table.attempts),
    index('ai_jobs_status_next_run_idx').on(table.status, table.nextRunAt),
  ],
);

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    jobId: text('job_id'),
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ai_usage_user_created_idx').on(table.userId, table.createdAt),
  ],
);

export const aiGenerationJobsRelations = relations(
  aiGenerationJobs,
  ({ one }) => ({
    user: one(user, {
      fields: [aiGenerationJobs.userId],
      references: [user.id],
    }),
  }),
);

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  user: one(user, {
    fields: [aiUsage.userId],
    references: [user.id],
  }),
}));
