import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from '../database/schema';

export const remelonRev = pgSequence('remelon_rev');

export const remelonSyncMeta = pgTable('remelon_sync_meta', {
  key: text('key').primaryKey(),
  value: bigint('value', { mode: 'number' }).notNull(),
});

export const remelonRevisionCheckpoints = pgTable(
  'remelon_revision_checkpoints',
  {
    observedAt: timestamp('observed_at', { withTimezone: true }).primaryKey(),
    rev: bigint('rev', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('remelon_revision_checkpoints_observed_at_idx').on(table.observedAt),
  ],
);

export const userDecks = pgTable(
  'user_decks',
  {
    id: text('id').primaryKey(),
    rev: bigint('rev', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: doublePrecision('created_at').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
  },
  (table) => [
    index('user_decks_user_rev_idx').on(table.userId, table.rev),
    index('user_decks_user_updated_idx').on(table.userId, table.updatedAt),
    check(
      'user_decks_created_at_safe_integer_check',
      sql`${table.createdAt} >= 0 and ${table.createdAt} <= 9007199254740991 and ${table.createdAt} = trunc(${table.createdAt})`,
    ),
    check(
      'user_decks_updated_at_safe_integer_check',
      sql`${table.updatedAt} >= 0 and ${table.updatedAt} <= 9007199254740991 and ${table.updatedAt} = trunc(${table.updatedAt})`,
    ),
  ],
);

export const userCards = pgTable(
  'user_cards',
  {
    id: text('id').primaryKey(),
    rev: bigint('rev', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    deckId: text('deck_id').notNull(),
    front: text('front').notNull(),
    back: text('back').notNull(),
    dueAt: doublePrecision('due_at').notNull(),
    createdAt: doublePrecision('created_at').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
  },
  (table) => [
    index('user_cards_user_rev_idx').on(table.userId, table.rev),
    index('user_cards_user_updated_idx').on(table.userId, table.updatedAt),
    index('user_cards_user_due_idx').on(table.userId, table.dueAt),
    check(
      'user_cards_due_at_safe_integer_check',
      sql`${table.dueAt} >= 0 and ${table.dueAt} <= 9007199254740991 and ${table.dueAt} = trunc(${table.dueAt})`,
    ),
    check(
      'user_cards_created_at_safe_integer_check',
      sql`${table.createdAt} >= 0 and ${table.createdAt} <= 9007199254740991 and ${table.createdAt} = trunc(${table.createdAt})`,
    ),
    check(
      'user_cards_updated_at_safe_integer_check',
      sql`${table.updatedAt} >= 0 and ${table.updatedAt} <= 9007199254740991 and ${table.updatedAt} = trunc(${table.updatedAt})`,
    ),
  ],
);

export const reviewEvents = pgTable(
  'review_events',
  {
    id: text('id').primaryKey(),
    rev: bigint('rev', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userCardId: text('user_card_id').notNull(),
    rating: integer('rating').notNull(),
    reviewedAt: doublePrecision('reviewed_at').notNull(),
  },
  (table) => [
    index('review_events_user_rev_idx').on(table.userId, table.rev),
    index('review_events_user_card_idx').on(table.userId, table.userCardId),
    check('review_events_rating_check', sql`${table.rating} between 1 and 4`),
    check(
      'review_events_reviewed_at_safe_integer_check',
      sql`${table.reviewedAt} >= 0 and ${table.reviewedAt} <= 9007199254740991 and ${table.reviewedAt} = trunc(${table.reviewedAt})`,
    ),
  ],
);

export const userDecksRelations = relations(userDecks, ({ one, many }) => ({
  user: one(user, {
    fields: [userDecks.userId],
    references: [user.id],
  }),
  cards: many(userCards),
}));

export const userCardsRelations = relations(userCards, ({ one, many }) => ({
  user: one(user, {
    fields: [userCards.userId],
    references: [user.id],
  }),
  deck: one(userDecks, {
    fields: [userCards.deckId],
    references: [userDecks.id],
  }),
  reviews: many(reviewEvents),
}));

export const reviewEventsRelations = relations(reviewEvents, ({ one }) => ({
  user: one(user, {
    fields: [reviewEvents.userId],
    references: [user.id],
  }),
  card: one(userCards, {
    fields: [reviewEvents.userCardId],
    references: [userCards.id],
  }),
}));
