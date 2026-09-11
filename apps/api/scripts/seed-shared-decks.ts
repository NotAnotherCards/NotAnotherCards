import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

// Load the api's environment variables
config({ path: resolve(__dirname, '../.env') });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { user } from '../src/database/schema';
import {
  userProfiles,
  userDecks,
  userNotes,
  userNoteDecks,
  userCards,
} from '../src/sync/schema';
import { publishedDecks, type PublishedContent } from '../src/sharing/schema';

// Constants replicating `@repo/offline-db` to avoid cross-workspace dependency issues in root scripts
const BASIC_NOTE_TYPE = 'basic';
const BASIC_NOTE_FIELDS_VERSION = 1;
const BASIC_FRONT_BACK_TEMPLATE_KEY = 'basic-front-back';

const NOTANOTHERCARDS_USER_ID = 'notanothercards-admin-user';
const NOTANOTHERCARDS_USERNAME = 'notanothercards';
const NOTANOTHERCARDS_EMAIL = 'admin@notanothercards.com';

const NOW = Date.now();

const STARTER_DECKS = [
  {
    id: randomUUID(),
    title: 'Top 100 Spanish Words',
    description:
      'A curated list of the 100 most common Spanish words for beginners.',
    visibility: 'public' as const,
    noteType: BASIC_NOTE_TYPE,
    cards: [
      { front: 'el/la', back: 'the' },
      { front: 'de', back: 'of, from' },
      { front: 'que', back: 'that, which' },
      { front: 'y', back: 'and' },
      { front: 'a', back: 'to, at' },
      { front: 'en', back: 'in, on' },
      { front: 'un/una', back: 'a, an' },
      { front: 'ser', back: 'to be (permanent)' },
      { front: 'se', back: 'oneself, itself' },
      { front: 'no', back: 'no, not' },
    ],
  },
  {
    id: randomUUID(),
    title: 'Top 100 French Words',
    description: 'Essential French vocabulary for your first trip to Paris.',
    visibility: 'public' as const,
    noteType: BASIC_NOTE_TYPE,
    cards: [
      { front: 'le/la', back: 'the' },
      { front: 'de', back: 'of, from' },
      { front: 'un/une', back: 'a, an' },
      { front: 'être', back: 'to be' },
      { front: 'et', back: 'and' },
      { front: 'à', back: 'to, at' },
      { front: 'il', back: 'he, it' },
      { front: 'avoir', back: 'to have' },
      { front: 'ne', back: 'not' },
      { front: 'je', back: 'I' },
    ],
  },
  {
    id: randomUUID(),
    title: 'Top 100 German Words',
    description: 'The foundation of the German language, start here!',
    visibility: 'public' as const,
    noteType: BASIC_NOTE_TYPE,
    cards: [
      { front: 'der/die/das', back: 'the' },
      { front: 'und', back: 'and' },
      { front: 'sein', back: 'to be' },
      { front: 'in', back: 'in' },
      { front: 'ein', back: 'a, an' },
      { front: 'zu', back: 'to, at' },
      { front: 'haben', back: 'to have' },
      { front: 'ich', back: 'I' },
      { front: 'werden', back: 'to become' },
      { front: 'sie', back: 'she, they' },
    ],
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in apps/api/.env');
  }

  console.log('Connecting to database...');
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log('Ensuring admin user exists...');

    // 1. Ensure the underlying user account exists
    await db
      .insert(user)
      .values({
        id: NOTANOTHERCARDS_USER_ID,
        name: 'NotAnotherCards Admin',
        email: NOTANOTHERCARDS_EMAIL,
        onBoardingComplete: true,
      })
      .onConflictDoNothing();

    // 2. Ensure the user profile (with the public @username) exists
    await db
      .insert(userProfiles)
      .values({
        userId: NOTANOTHERCARDS_USER_ID,
        rev: sql`nextval('remelon_rev')`,
        username: NOTANOTHERCARDS_USERNAME,
        bio: 'The official NotAnotherCards account providing starter content.',
        createdAt: NOW,
        updatedAt: NOW,
      })
      .onConflictDoNothing();

    console.log('Seeding foundational decks...');

    for (const deck of STARTER_DECKS) {
      console.log(`Seeding deck: ${deck.title}`);

      // 3. Create the Deck, marked as 'public' so it appears in the shared feed
      await db.insert(userDecks).values({
        id: deck.id,
        userId: NOTANOTHERCARDS_USER_ID,
        rev: sql`nextval('remelon_rev')`,
        title: deck.title,
        description: deck.description,
        noteType: deck.noteType,
        visibility: deck.visibility,
        createdAt: NOW,
        updatedAt: NOW,
      });

      const publishedNotes: PublishedContent['notes'] = [];
      const publishedCards: PublishedContent['cards'] = [];

      // 4. Insert Notes & Cards for the deck
      for (const cardData of deck.cards) {
        const noteId = randomUUID();
        const cardId = randomUUID();
        const noteDeckId = randomUUID();

        // Create the abstract Note (holds the raw data)
        await db.insert(userNotes).values({
          id: noteId,
          userId: NOTANOTHERCARDS_USER_ID,
          rev: sql`nextval('remelon_rev')`,
          noteType: deck.noteType,
          fieldsVersion: BASIC_NOTE_FIELDS_VERSION,
          fieldsJson: JSON.stringify({
            front: cardData.front,
            back: cardData.back,
          }),
          createdAt: NOW,
          updatedAt: NOW,
        });

        publishedNotes.push({
          id: noteId,
          note_type: deck.noteType,
          fields_version: BASIC_NOTE_FIELDS_VERSION,
          fields_json: JSON.stringify({
            front: cardData.front,
            back: cardData.back,
          }),
          additional_content: null,
        });

        // Link the Note specifically to this Deck
        await db.insert(userNoteDecks).values({
          id: noteDeckId,
          userId: NOTANOTHERCARDS_USER_ID,
          rev: sql`nextval('remelon_rev')`,
          noteId: noteId,
          deckId: deck.id,
          active: true,
          createdAt: NOW,
          updatedAt: NOW,
        });

        // Create the actual playable Card generated from the Note
        await db.insert(userCards).values({
          id: cardId,
          userId: NOTANOTHERCARDS_USER_ID,
          rev: sql`nextval('remelon_rev')`,
          noteId: noteId,
          templateKey: BASIC_FRONT_BACK_TEMPLATE_KEY,
          active: true,
          front: cardData.front,
          back: cardData.back,
          dueAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        });

        publishedCards.push({
          id: cardId,
          note_id: noteId,
          template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
          front: cardData.front,
          back: cardData.back,
        });
      }

      // 5. Publish the deck snapshot
      await db.insert(publishedDecks).values({
        deckId: deck.id,
        userId: NOTANOTHERCARDS_USER_ID,
        title: deck.title,
        description: deck.description,
        noteType: deck.noteType,
        nativeLanguageId: null,
        targetLanguageId: null,
        cardCount: publishedCards.length,
        content: {
          notes: publishedNotes,
          cards: publishedCards,
        },
        publishedAt: new Date(NOW),
      });
    }

    console.log('Successfully seeded foundational decks!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await pool.end();
  }
}

main();
