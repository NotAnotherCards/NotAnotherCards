import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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

// Content only: the live deck's visibility and tombstone remain the gate.
export const publishedDecks = pgTable('published_decks', {
  deckId: text('deck_id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  noteType: text('note_type').notNull(),
  nativeLanguageId: text('native_language_id'),
  targetLanguageId: text('target_language_id'),
  cardCount: integer('card_count').notNull(),
  content: jsonb('content').$type<PublishedContent>().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
