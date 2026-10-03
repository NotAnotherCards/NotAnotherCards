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
  it('keeps an explicit active value and defaults a missing one to inactive', async () => {
    await openDb();

    const csvContent = `front,back,deck,active
active front,active back,Imported,true
inactive front,inactive back,Imported,false
default front,default back,Imported,
`;

    const report = await validateAndImportData(db, csvContent, {
      format: 'csv',
      dryRun: false,
    });

    expect(report.success).toBe(true);
    expect(
      (await db.get(UserCard).query().fetch())
        .sort((first, second) => first.front.localeCompare(second.front))
        .map((card) => ({ front: card.front, active: card.active })),
    ).toEqual([
      { front: 'active front', active: true },
      { front: 'default front', active: false },
      { front: 'inactive front', active: false },
    ]);
  });

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

describe('validateAndImportJson', () => {
  it('keeps an explicit active value and defaults a missing one to inactive', async () => {
    await openDb();

    const content = JSON.stringify({
      format: 1,
      exported_at: new Date().toISOString(),
      decks: [
        {
          source_id: 'deck-1',
          title: 'Imported',
          description: null,
          note_type: 'basic',
          native_language: null,
          target_language: null,
        },
      ],
      notes: [
        {
          source_id: 'note-active',
          note_type: 'basic',
          fields_version: 1,
          fields: { front: 'active front', back: 'active back' },
          additional_content: null,
          decks: ['deck-1'],
          cards: [
            {
              source_id: 'card-active',
              template_key: 'front-back',
              active: true,
              due_at: 1,
              scheduled_interval_minutes: 5,
            },
          ],
        },
        {
          source_id: 'note-default',
          note_type: 'basic',
          fields_version: 1,
          fields: { front: 'default front', back: 'default back' },
          additional_content: null,
          decks: ['deck-1'],
          cards: [
            {
              source_id: 'card-default',
              template_key: 'front-back',
              due_at: 2,
              scheduled_interval_minutes: 10,
            },
          ],
        },
      ],
      review_events: [],
      media: [],
    });

    const report = await validateAndImportData(db, content, {
      format: 'json',
      dryRun: false,
    });

    expect(report.success).toBe(true);
    expect(
      (await db.get(UserCard).query().fetch())
        .sort((first, second) => first.front.localeCompare(second.front))
        .map((card) => ({
          front: card.front,
          active: card.active,
          dueAt: card.due_at,
          interval: card.scheduled_interval_minutes,
        })),
    ).toEqual([
      { front: 'active front', active: true, dueAt: 1, interval: 5 },
      { front: 'default front', active: false, dueAt: 2, interval: 10 },
    ]);
  });
});
