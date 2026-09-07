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
          message: expect.stringContaining('CSV imports can only target basic decks'),
        }),
      ]),
    );

    // Ensure no notes or cards were written
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
  });

  it('reuses an existing basic deck with a matching title', async () => {
    await openDb();
    
    // Seed a basic deck titled "Spanish"
    const deck = await createDeck(db, 'Spanish', null, {
      noteType: 'basic',
    });

    const csvContent = `front,back,deck
adios,goodbye,Spanish
`;

    const report = await validateAndImportData(db, csvContent, {
      format: 'csv',
      dryRun: false,
    });

    expect(report.success).toBe(true);
    expect(report.errors).toHaveLength(0);

    // Verify it reused the deck
    const decks = await db.get(UserDeck).query().fetch();
    expect(decks).toHaveLength(1);
    expect(decks[0].id).toBe(deck.id);

    // Verify rows were written
    expect(await db.get(UserNote).query().fetch()).toHaveLength(1);
  });
});
