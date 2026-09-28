import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import { cardId, noteDeckId } from './ids.js';
import {
  createNote,
  createNotesBatch,
  updateNoteFields,
} from './note-writes.js';
import { activateWordsInDeck, createDeck } from './queries.js';
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

const createWordDeck = async () =>
  await createDeck(db, 'Words', null, {
    noteType: 'word',
    nativeLanguageId: 'lang-en',
    targetLanguageId: 'lang-de',
  });

describe('createDeck', () => {
  it('rejects unknown note types and identical word languages', async () => {
    await openDb();
    await expect(
      createDeck(db, 'Unknown', null, {
        noteType: 'cloze' as 'basic',
      }),
    ).rejects.toThrow("Unknown deck note type 'cloze'");
    await expect(
      createDeck(db, 'English', null, {
        noteType: 'word',
        nativeLanguageId: 'lang-en',
        targetLanguageId: 'lang-en',
      }),
    ).rejects.toThrow('needs two different languages');
    expect(await db.get(UserDeck).query().fetch()).toHaveLength(0);
  });
});

describe('createNote', () => {
  it('writes note, membership and sibling cards atomically', async () => {
    await openDb();
    const deck = await createWordDeck();
    const note = await createNote(db, deck.id, {
      noteType: 'word',
      fieldsVersion: 1,
      fields: word,
    });
    expect(note.note_type).toBe('word');
    const membership = await db
      .get(UserNoteDeck)
      .find(noteDeckId(note.id, deck.id));
    expect(membership.active).toBe(true);
    const cards = (await db.get(UserCard).query().fetch()).filter(
      (c) => c.note_id === note.id,
    );
    expect(cards).toHaveLength(2);
  });

  it('rejects invalid fields before anything is written', async () => {
    await openDb();
    const deck = await createWordDeck();
    await expect(
      createNote(db, deck.id, {
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
    const deck = await createWordDeck();
    const note = await createNote(db, deck.id, {
      noteType: 'word',
      fieldsVersion: 1,
      fields: { ...word, word: '  Hund  ' },
    });
    expect(JSON.parse(note.fields_json)).toMatchObject({ word: 'Hund' });
  });
});

describe('activateWordsInDeck', () => {
  it('activates every sibling of only the requested oldest words', async () => {
    await openDb();
    const deck = await createWordDeck();
    const first = await createNote(db, deck.id, {
      noteType: 'word',
      fieldsVersion: 1,
      fields: word,
    });
    const second = await createNote(db, deck.id, {
      noteType: 'word',
      fieldsVersion: 1,
      fields: { ...word, word: 'Katze', translation: 'cat' },
    });
    await db.write(async () => {
      const firstMembership = await db
        .get(UserNoteDeck)
        .find(noteDeckId(first.id, deck.id));
      const secondMembership = await db
        .get(UserNoteDeck)
        .find(noteDeckId(second.id, deck.id));
      await firstMembership.update((record) => {
        record.created_at = 10;
        record.updated_at = 10;
      });
      await secondMembership.update((record) => {
        record.created_at = 20;
        record.updated_at = 20;
      });
    });

    const activated = await activateWordsInDeck(db, deck.id, 1);
    expect(activated).toEqual([first.id]);

    const firstCards = (await db.get(UserCard).query().fetch()).filter(
      (card) => card.note_id === first.id,
    );
    const secondCards = (await db.get(UserCard).query().fetch()).filter(
      (card) => card.note_id === second.id,
    );
    expect(firstCards.every((card) => card.active)).toBe(true);
    expect(secondCards.every((card) => !card.active)).toBe(true);
  });
});

describe('updateNoteFields', () => {
  it('updates fields and cards in one batch', async () => {
    await openDb();
    const deck = await createWordDeck();
    const note = await createNote(db, deck.id, {
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
  it('creates a new basic deck and its notes in one batch', async () => {
    await openDb();
    const deckId = await createNotesBatch(db, {
      deckIdOrTitle: 'German A1',
      isNew: true,
      notes: [
        {
          noteType: 'basic',
          fieldsVersion: 1,
          fields: { front: 'die Zahl 1', back: 'eins' },
        },
      ],
    });
    const deck = await db.get(UserDeck).find(deckId);
    expect(deck).toMatchObject({
      title: 'German A1',
      visibility: 'private',
      note_type: 'basic',
      native_language_id: null,
      target_language_id: null,
    });
    expect(await db.get(UserNote).query().fetch()).toHaveLength(1);
    expect(await db.get(UserCard).query().fetch()).toHaveLength(1);
    expect(await db.get(UserNoteDeck).query().fetch()).toHaveLength(1);
  });

  it('rejects notes that do not match a new or existing deck', async () => {
    await openDb();
    await expect(
      createNotesBatch(db, {
        deckIdOrTitle: 'Mixed',
        isNew: true,
        notes: [{ noteType: 'word', fieldsVersion: 1, fields: word }],
      }),
    ).rejects.toThrow("A 'basic' deck cannot contain a 'word' note");

    const wordDeck = await createWordDeck();
    await expect(
      createNotesBatch(db, {
        deckIdOrTitle: wordDeck.id,
        isNew: false,
        notes: [
          {
            noteType: 'basic',
            fieldsVersion: 1,
            fields: { front: 'Hund', back: 'dog' },
          },
        ],
      }),
    ).rejects.toThrow("A 'word' deck cannot contain a 'basic' note");
  });

  it('one invalid note aborts the whole batch', async () => {
    await openDb();
    await expect(
      createNotesBatch(db, {
        deckIdOrTitle: 'Broken',
        isNew: true,
        notes: [
          {
            noteType: 'basic',
            fieldsVersion: 1,
            fields: { front: 'Hund', back: 'dog' },
          },
          { noteType: 'basic', fieldsVersion: 1, fields: { front: 'alone' } },
        ],
      }),
    ).rejects.toThrow();
    expect(await db.get(UserDeck).query().fetch()).toHaveLength(0);
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
  });
});
