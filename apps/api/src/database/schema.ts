import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const cardTypeEnum = pgEnum('card_type', [
  'WORD',
  'COMPARISON',
  'PHRASE',
]);

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    username: text('username').notNull(),
    timezone: text('timezone').default('UTC'),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex('user_username_idx').on(table.username)],
);

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const userDecks = pgTable(
  'user_decks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_user_decks_user_updated').on(table.userId, table.updatedAt),
  ],
);

export const userCards = pgTable(
  'user_cards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    deckId: text('deck_id')
      .notNull()
      .references(() => userDecks.id, { onDelete: 'cascade' }),
    cardType: cardTypeEnum('card_type').default('WORD').notNull(),
    front: text('front').notNull(),
    back: text('back').notNull(),
    contextSentence: text('context_sentence'),
    dueAt: timestamp('due_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_user_cards_user_updated').on(table.userId, table.updatedAt),
    index('idx_user_cards_due').on(table.userId, table.dueAt),
  ],
);

export const reviewEvents = pgTable(
  'review_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userCardId: text('user_card_id')
      .notNull()
      .references(() => userCards.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_review_events_user_card').on(table.userId, table.userCardId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  decks: many(userDecks),
  cards: many(userCards),
  reviewEvents: many(reviewEvents),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

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
