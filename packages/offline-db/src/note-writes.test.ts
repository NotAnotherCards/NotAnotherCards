import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import { cardId, noteDeckId } from './ids.js';
import {
  createNote,
  createNotesBatch,
  updateNoteFields,
} from './note-writes.js';
import { schema } from './index.js';
import {
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
} from './user-dictionary.js';

const word = {
  word: 'Hund',
  translation: 'dog',
  native_language_id: 'lang-en',
  target_language_id: 'lang-de',
};

let db: Database;
afterEach(async () => {
  await db.close();
});
const openDb = async () => {
  db = await Database.open({
    driver: new NodeSqliteDriver(),
    schema,
    modelClasses: [UserDeck, UserNote, UserCard, UserNoteDeck],
    name: ':memory:',
  });
};

describe('createNote', () => {
  it('writes note, membership and sibling cards atomically', async () => {
    await openDb();
    const note = await createNote(db, 'deck-1', {
      noteType: 'word',
      fieldsVersion: 1,
      fields: word,
    });
    expect(note.note_type).toBe('word');
    const membership = await db
      .get(UserNoteDeck)
      .find(noteDeckId(note.id, 'deck-1'));
    expect(membership.active).toBe(true);
    const cards = (await db.get(UserCard).query().fetch()).filter(
      (c) => c.note_id === note.id,
    );
    expect(cards).toHaveLength(2);
  });

  it('rejects invalid fields before anything is written', async () => {
    await openDb();
    await expect(
      createNote(db, 'deck-1', {
        noteType: 'word',
        fieldsVersion: 1,
        fields: { word: 'Hund' },
      }),
    ).rejects.toThrow();
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
    expect(await db.get(UserCard).query().fetch()).toHaveLength(0);
  });

  it('stores canonical fields_json', async () => {
    await openDb();
    const note = await createNote(db, 'deck-1', {
      noteType: 'word',
      fieldsVersion: 1,
      fields: { ...word, word: '  Hund  ' },
    });
    expect(JSON.parse(note.fields_json)).toMatchObject({ word: 'Hund' });
  });
});

describe('updateNoteFields', () => {
  it('updates fields and cards in one batch', async () => {
    await openDb();
    const note = await createNote(db, 'deck-1', {
      noteType: 'word',
      fieldsVersion: 1,
      fields: word,
    });
    await updateNoteFields(db, note.id, {
      ...word,
      example: 'Der Hund schläft.',
      example_translation: 'The dog sleeps.',
    });
    const example = await db
      .get(UserCard)
      .find(cardId(note.id, 'example-to-translation'));
    expect(example.front).toBe('Der Hund schläft.');
  });
});

describe('createNotesBatch', () => {
  it('creates a new deck with mixed note types in one batch', async () => {
    await openDb();
    const deckId = await createNotesBatch(db, {
      deckIdOrTitle: 'German A1',
      isNew: true,
      notes: [
        { noteType: 'word', fieldsVersion: 1, fields: word },
        {
          noteType: 'basic',
          fieldsVersion: 1,
          fields: { front: 'die Zahl 1', back: 'eins' },
        },
      ],
    });
    const deck = await db.get(UserDeck).find(deckId);
    expect(deck.title).toBe('German A1');
    expect(await db.get(UserNote).query().fetch()).toHaveLength(2);
    // 2 word siblings + 1 basic card
    expect(await db.get(UserCard).query().fetch()).toHaveLength(3);
    expect(await db.get(UserNoteDeck).query().fetch()).toHaveLength(2);
  });

  it('one invalid note aborts the whole batch', async () => {
    await openDb();
    await expect(
      createNotesBatch(db, {
        deckIdOrTitle: 'Broken',
        isNew: true,
        notes: [
          { noteType: 'word', fieldsVersion: 1, fields: word },
          { noteType: 'word', fieldsVersion: 1, fields: { word: 'alone' } },
        ],
      }),
    ).rejects.toThrow();
    expect(await db.get(UserDeck).query().fetch()).toHaveLength(0);
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
  });
});
