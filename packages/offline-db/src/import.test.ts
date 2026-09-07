import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import { schema } from './index.js';
import {
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
} from './user-dictionary.js';
import { createDeck } from './queries.js';
import { validateAndImportData } from './import.js';
import { systemDeckId } from './ids.js';

let db: Database;

afterEach(async () => {
  if (db) await db.close();
});

const openDb = async () => {
  db = await Database.open({
    driver: new NodeSqliteDriver(),
    schema,
    modelClasses: [UserDeck, UserNote, UserCard, UserNoteDeck],
    name: ':memory:',
  });
};

describe('validateAndImportCsv', () => {
  it('rejects CSV targeting an existing non-basic deck by title', async () => {
    await openDb();

    // Seed a word deck titled "Spanish"
    await createDeck(db, 'Spanish', null, {
      noteType: 'word',
      nativeLanguageId: '00000000-0000-0000-0000-000000000001',
      targetLanguageId: '00000000-0000-0000-0000-000000000002',
    });

    const csvContent = `front,back,deck
hola,hello,Spanish
`;

    const report = await validateAndImportData(db, csvContent, {
      format: 'csv',
      dryRun: false,
    });

    expect(report.success).toBe(false);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NON_BASIC_DECK_MATCH',
          message: expect.stringContaining(
            'CSV imports can only target basic decks',
          ),
        }),
      ]),
    );

    // Ensure no notes or cards were written
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
  });

  it('imports into the Cards system collection and ignores the CSV deck column', async () => {
    await openDb();

    // Even though the CSV specifies "Spanish", it should go to "Cards"
    const csvContent = `front,back,deck
adios,goodbye,Spanish
`;

    const report = await validateAndImportData(db, csvContent, {
      format: 'csv',
      dryRun: false,
    });

    expect(report.success).toBe(true);
    expect(report.errors).toHaveLength(0);

    // Verify it created ONLY the Cards system deck, not 'Spanish'
    const decks = await db.get(UserDeck).query().fetch();
    expect(decks).toHaveLength(1);
    expect(decks[0].title).toBe('Cards');
    expect(decks[0].id).toBe(systemDeckId('cards'));

    // Verify rows were written
    const notes = await db.get(UserNote).query().fetch();
    expect(notes).toHaveLength(1);

    // Verify membership connects to Cards
    const memberships = await db.get(UserNoteDeck).query().fetch();
    expect(memberships).toHaveLength(1);
    expect(memberships[0].deck_id).toBe(decks[0].id);
  });
});

describe('validateAndImportJson', () => {
  it('routes word notes to the correct All Words system collection', async () => {
    await openDb();

    const jsonContent = JSON.stringify({
      format: 1,
      decks: [
        {
          source_id: 'deck-1',
          title: 'My Custom Spanish Deck',
          note_type: 'word',
          native_language: '00000000-0000-0000-0000-000000000001',
          target_language: '00000000-0000-0000-0000-000000000002',
        }
      ],
      notes: [
        {
          note_type: 'word',
          fields_version: 1,
          fields: {
            word: 'hola',
            translation: 'hello',
            native_language_id: '00000000-0000-0000-0000-000000000001',
            target_language_id: '00000000-0000-0000-0000-000000000002'
          },
          decks: ['deck-1'],
          cards: [
            {
              source_id: 'card-1',
              template_key: 'word-to-translation',
              active: true,
              due_at: 0,
              scheduled_interval_minutes: 0
            }
          ]
        }
      ]
    });

    const report = await validateAndImportData(db, jsonContent, {
      format: 'json',
      dryRun: false,
    });

    expect(report.success).toBe(true);

    // Verify it created ONLY the "All Words" system deck for Spanish, ignoring the custom deck
    const decks = await db.get(UserDeck).query().fetch();
    expect(decks).toHaveLength(1);
    expect(decks[0].title).toBe('All Words');
    expect(decks[0].target_language_id).toBe('00000000-0000-0000-0000-000000000002');
    expect(decks[0].id).toBe(systemDeckId('words', '00000000-0000-0000-0000-000000000002'));

    // Verify membership connects ONLY to the system collection
    const memberships = await db.get(UserNoteDeck).query().fetch();
    expect(memberships).toHaveLength(1);
    expect(memberships[0].deck_id).toBe(decks[0].id);
  });
});
