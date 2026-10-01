import { afterEach, describe, expect, it } from 'vitest';
import { Database, synchronize } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import { noteDeckId } from './ids.js';
import { createNote } from './note-writes.js';
import { createDeck, deleteDeck, removeNoteFromDeck } from './queries.js';
import { schema } from './index.js';
import { rejectionsConcernDeck } from './sync-status.js';
import {
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
} from './user-dictionary.js';

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

const wordDeck = async (title: string) =>
  await createDeck(db, title, null, {
    noteType: 'word',
    nativeLanguageId: 'lang-en',
    targetLanguageId: 'lang-de',
  });
const addWord = async (deckId: string, word: string) =>
  await createNote(db, deckId, {
    noteType: 'word',
    fieldsVersion: 1,
    fields: {
      word,
      translation: `${word} in english`,
      native_language_id: 'lang-en',
      target_language_id: 'lang-de',
    },
  });

describe('rejectionsConcernDeck', () => {
  it('ignores refused rows of another deck and of unrelated tables', async () => {
    await openDb();
    const mine = await wordDeck('Mine');
    const other = await wordDeck('Other');
    const theirs = await addWord(other.id, 'Katze');
    const theirCard = (await db.get(UserCard).query().fetch()).find(
      (card) => card.note_id === theirs.id,
    )!;

    expect(
      await rejectionsConcernDeck(db, mine.id, {
        user_decks: [other.id],
        user_note_decks: [noteDeckId(theirs.id, other.id)],
        user_notes: [theirs.id],
        user_cards: [theirCard.id],
        review_events: ['r1'],
        user_profiles: ['p1'],
      }),
    ).toBe(false);
  });

  it('blocks on the deck, its membership, its note or its card', async () => {
    await openDb();
    const mine = await wordDeck('Mine');
    const note = await addWord(mine.id, 'Hund');
    const card = (await db.get(UserCard).query().fetch()).find(
      (c) => c.note_id === note.id,
    )!;

    expect(
      await rejectionsConcernDeck(db, mine.id, { user_decks: [mine.id] }),
    ).toBe(true);
    expect(
      await rejectionsConcernDeck(db, mine.id, {
        user_note_decks: [noteDeckId(note.id, mine.id)],
      }),
    ).toBe(true);
    expect(
      await rejectionsConcernDeck(db, mine.id, { user_notes: [note.id] }),
    ).toBe(true);
    expect(
      await rejectionsConcernDeck(db, mine.id, { user_cards: [card.id] }),
    ).toBe(true);
  });

  it('lets go of a note once the server accepted its removal', async () => {
    // A synced inactive membership is history: a later refusal of that
    // note concerns the deck it is still in, not the one it left.
    await openDb();
    const a = await wordDeck('A');
    const b = await wordDeck('B');
    const note = await addWord(a.id, 'Hund');
    await db.write(() =>
      db.get(UserNoteDeck).create({
        id: noteDeckId(note.id, b.id),
        note_id: note.id,
        deck_id: b.id,
        active: true,
        created_at: 1,
        updated_at: 1,
      }),
    );
    const sync = () =>
      synchronize({
        database: db,
        pullChanges: async () => ({ changes: {}, cursor: '1' }),
        pushChanges: async () => ({ changes: null, cursor: null }),
      });
    await sync();
    await removeNoteFromDeck(db, note.id, a.id);
    // refused, so still pending: A is still concerned
    expect(
      await rejectionsConcernDeck(db, a.id, { user_notes: [note.id] }),
    ).toBe(true);
    await sync();

    expect(
      await rejectionsConcernDeck(db, a.id, { user_notes: [note.id] }),
    ).toBe(false);
    expect(
      await rejectionsConcernDeck(db, b.id, { user_notes: [note.id] }),
    ).toBe(true);
  });

  it('still blocks when the refused membership was deleted locally', async () => {
    // A refused removal is what must block: otherwise the server keeps
    // content the user took out of the deck.
    await openDb();
    const mine = await wordDeck('Mine');
    const note = await addWord(mine.id, 'Hund');
    await deleteDeck(db, mine.id);
    expect(await db.get(UserNoteDeck).query().fetch()).toHaveLength(0);

    expect(
      await rejectionsConcernDeck(db, mine.id, {
        user_note_decks: [noteDeckId(note.id, mine.id)],
      }),
    ).toBe(true);
  });
});
