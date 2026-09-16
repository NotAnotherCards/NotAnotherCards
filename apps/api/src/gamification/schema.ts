import { relations, sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from '../database/schema';

export const badgeAwards = pgTable(
  'badge_awards',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    badgeCode: text('badge_code').notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: 'badge_awards_user_code_pk',
      columns: [table.userId, table.badgeCode],
    }),
    index('badge_awards_user_awarded_idx').on(table.userId, table.awardedAt),
    check(
      'badge_awards_code_check',
      sql`${table.badgeCode} in ('first-review', 'seven-day-streak', 'hundred-reviews')`,
    ),
  ],
);

export const dailyChallengeCompletions = pgTable(
  'daily_challenge_completions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    challengeCode: text('challenge_code').notNull(),
    utcDate: date('utc_date', { mode: 'string' }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: 'daily_challenge_completions_user_code_date_pk',
      columns: [table.userId, table.challengeCode, table.utcDate],
    }),
    index('daily_challenge_completions_user_date_idx').on(
      table.userId,
      table.utcDate,
    ),
    check(
      'daily_challenge_completions_code_check',
      sql`${table.challengeCode} in ('daily-review', 'new-vocabulary')`,
    ),
  ],
);

export const badgeAwardsRelations = relations(badgeAwards, ({ one }) => ({
  user: one(user, {
    fields: [badgeAwards.userId],
    references: [user.id],
  }),
}));

export const dailyChallengeCompletionsRelations = relations(
  dailyChallengeCompletions,
  ({ one }) => ({
    user: one(user, {
      fields: [dailyChallengeCompletions.userId],
      references: [user.id],
    }),
  }),
);
