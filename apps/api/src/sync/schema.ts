import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { REVIEW_INTERVAL_CAP_MINUTES } from '@repo/offline-db';
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
    // Which note contract this deck's notes follow. Insert-only, and the
    // known set is enforced in cross-validation so a client cannot claim
    // one value while another persists.
    noteType: text('note_type').notNull(),
    // Defaults a word deck's note form starts from; the note stays the
    // canonical source of its own languages.
    nativeLanguageId: uuid('native_language_id'),
    targetLanguageId: uuid('target_language_id'),
    createdAt: doublePrecision('created_at').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
  },
  (table) => [
    index('user_decks_user_rev_idx').on(table.userId, table.rev),
    index('user_decks_user_updated_idx').on(table.userId, table.updatedAt),
    check(
      'user_decks_languages_match_note_type_check',
      sql`case when ${table.noteType} = 'word' then ${table.nativeLanguageId} is not null and ${table.targetLanguageId} is not null else ${table.nativeLanguageId} is null and ${table.targetLanguageId} is null end`,
    ),
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
    noteId: text('note_id').notNull(),
    templateKey: text('template_key').notNull(),
    active: boolean('active').notNull().default(true),
    front: text('front').notNull(),
    back: text('back').notNull(),
    dueAt: doublePrecision('due_at').notNull(),
    scheduledIntervalMinutes: integer('scheduled_interval_minutes')
      .notNull()
      .default(0),
    createdAt: doublePrecision('created_at').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
  },
  (table) => [
    index('user_cards_user_rev_idx').on(table.userId, table.rev),
    index('user_cards_user_updated_idx').on(table.userId, table.updatedAt),
    index('user_cards_note_idx').on(table.noteId),
    index('user_cards_user_due_idx').on(table.userId, table.dueAt),
    check(
      'user_cards_due_at_safe_integer_check',
      sql`${table.dueAt} >= 0 and ${table.dueAt} <= 9007199254740991 and ${table.dueAt} = trunc(${table.dueAt})`,
    ),
    check(
      'user_cards_scheduled_interval_minutes_range_check',
      // sql.raw: a bare JS number becomes a bind parameter, which
      // drizzle-kit serialises into generated migrations as `$1`
      sql`${table.scheduledIntervalMinutes} between 0 and ${sql.raw(String(REVIEW_INTERVAL_CAP_MINUTES))}`,
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

export const userNotes = pgTable(
  'user_notes',
  {
    id: text('id').primaryKey(),
    rev: bigint('rev', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    noteType: text('note_type').notNull(),
    fieldsVersion: integer('fields_version').notNull(),
    fieldsJson: text('fields_json').notNull(),
    additionalContent: text('additional_content'),
    createdAt: doublePrecision('created_at').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
  },
  (table) => [
    index('user_notes_user_rev_idx').on(table.userId, table.rev),
    index('user_notes_user_updated_idx').on(table.userId, table.updatedAt),
    check(
      'user_notes_created_at_safe_integer_check',
      sql`${table.createdAt} >= 0 and ${table.createdAt} <= 9007199254740991 and ${table.createdAt} = trunc(${table.createdAt})`,
    ),
    check(
      'user_notes_updated_at_safe_integer_check',
      sql`${table.updatedAt} >= 0 and ${table.updatedAt} <= 9007199254740991 and ${table.updatedAt} = trunc(${table.updatedAt})`,
    ),
  ],
);

export const userNoteDecks = pgTable(
  'user_note_decks',
  {
    id: text('id').primaryKey(),
    rev: bigint('rev', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    noteId: text('note_id').notNull(),
    deckId: text('deck_id').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: doublePrecision('created_at').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
  },
  (table) => [
    index('user_note_decks_user_rev_idx').on(table.userId, table.rev),
    index('user_note_decks_user_updated_idx').on(table.userId, table.updatedAt),
    index('user_note_decks_note_idx').on(table.noteId),
    index('user_note_decks_deck_idx').on(table.deckId),
    check(
      'user_note_decks_created_at_safe_integer_check',
      sql`${table.createdAt} >= 0 and ${table.createdAt} <= 9007199254740991 and ${table.createdAt} = trunc(${table.createdAt})`,
    ),
    check(
      'user_note_decks_updated_at_safe_integer_check',
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

export const userProfiles = pgTable(
  'user_profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    rev: bigint('rev', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    username: text('username').unique(),
    bio: text('bio'),
    avatarFileId: uuid('avatar_file_id'),
    nativeLanguageId: uuid('native_language_id'),
    targetLanguageId: uuid('target_language_id'),
    createdAt: doublePrecision('created_at').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
  },
  (table) => [
    index('user_profiles_user_rev_idx').on(table.userId, table.rev),
    index('user_profiles_user_updated_idx').on(table.userId, table.updatedAt),
    check(
      'user_profiles_created_at_safe_integer_check',
      sql`${table.createdAt} >= 0 and ${table.createdAt} <= 9007199254740991 and ${table.createdAt} = trunc(${table.createdAt})`,
    ),
    check(
      'user_profiles_updated_at_safe_integer_check',
      sql`${table.updatedAt} >= 0 and ${table.updatedAt} <= 9007199254740991 and ${table.updatedAt} = trunc(${table.updatedAt})`,
    ),
  ],
);

export const userDecksRelations = relations(userDecks, ({ one, many }) => ({
  user: one(user, {
    fields: [userDecks.userId],
    references: [user.id],
  }),
  noteDecks: many(userNoteDecks),
}));

export const userNotesRelations = relations(userNotes, ({ one, many }) => ({
  user: one(user, {
    fields: [userNotes.userId],
    references: [user.id],
  }),
  cards: many(userCards),
  noteDecks: many(userNoteDecks),
}));

export const userNoteDecksRelations = relations(userNoteDecks, ({ one }) => ({
  user: one(user, {
    fields: [userNoteDecks.userId],
    references: [user.id],
  }),
  note: one(userNotes, {
    fields: [userNoteDecks.noteId],
    references: [userNotes.id],
  }),
  deck: one(userDecks, {
    fields: [userNoteDecks.deckId],
    references: [userDecks.id],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(user, {
    fields: [userProfiles.userId],
    references: [user.id],
  }),
}));

export const userCardsRelations = relations(userCards, ({ one, many }) => ({
  user: one(user, {
    fields: [userCards.userId],
    references: [user.id],
  }),
  note: one(userNotes, {
    fields: [userCards.noteId],
    references: [userNotes.id],
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
