import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from '../database/schema';

export interface PublishedContent {
  notes: {
    id: string;
    note_type: string;
    fields_version: number;
    fields_json: string;
    additional_content: string | null;
  }[];
  cards: {
    id: string;
    note_id: string;
    template_key: string;
    front: string;
    back: string;
  }[];
}

export interface ModerationFinding {
  cardId: string;
  reason: string;
  classifier?: string;
}

export interface StoredModerationVerdict {
  reason?: string;
  flagged: ModerationFinding[];
  warnings: ModerationFinding[];
}

// Content only: the live deck's visibility and tombstone remain the gate.
export const publishedDecks = pgTable(
  'published_decks',
  {
    deckId: text('deck_id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    noteType: text('note_type').notNull(),
    nativeLanguageId: text('native_language_id'),
    targetLanguageId: text('target_language_id'),
    cardCount: integer('card_count').notNull(),
    content: jsonb('content').$type<PublishedContent>().notNull(),
    moderationStatus: text('moderation_status')
      .$type<'visible' | 'blocked'>()
      .default('visible')
      .notNull(),
    moderationVerdict:
      jsonb('moderation_verdict').$type<StoredModerationVerdict>(),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'published_decks_moderation_status_check',
      sql`${table.moderationStatus} in ('visible', 'blocked')`,
    ),
  ],
);

// One immutable row per person/deck report. Reports are operator-visible only
export const deckReports = pgTable(
  'deck_reports',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id').notNull(),
    reporterUserId: text('reporter_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    snapshotPublishedAt: timestamp('snapshot_published_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('deck_reports_reporter_deck_unique').on(
      table.reporterUserId,
      table.deckId,
    ),
    index('deck_reports_deck_created_idx').on(table.deckId, table.createdAt),
    index('deck_reports_reporter_created_idx').on(
      table.reporterUserId,
      table.createdAt,
    ),
  ],
);

// Durable audit trail for both automatic and operator takedowns
export const deckTakedowns = pgTable(
  'deck_takedowns',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id').notNull(),
    source: text('source').$type<'automatic' | 'operator'>().notNull(),
    reason: text('reason'),
    verdict: jsonb('verdict').$type<StoredModerationVerdict>().notNull(),
    snapshotPublishedAt: timestamp('snapshot_published_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'deck_takedowns_source_check',
      sql`${table.source} in ('automatic', 'operator')`,
    ),
    index('deck_takedowns_deck_created_idx').on(table.deckId, table.createdAt),
  ],
);
