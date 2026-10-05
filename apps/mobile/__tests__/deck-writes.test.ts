import { Database } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  schema,
  UserDeck,
  UserNote,
  UserCard,
  UserNoteDeck,
  ReviewEvent,
  UserProfile,
  getDecksQuery,
  activateWordsInDeck,
  createCard,
  getPersonalDictionaryQuery,
  getNoteDecksQuery,
  noteDeckId,
} from '@repo/offline-db';
import { selectDueCards } from '@repo/study';
import { deckWrites } from '@/lib/deck-writes';

// The writes themselves are the shared ones; what is mobile's here is the
// sync wake-up after each of them. Run against a real in-memory database
// so the shared functions are exercised through the same driver family.
const openDb = () =>
  Database.open({
    driver: new NodeSqliteDriver(),
    schema,
    modelClasses: [
      UserDeck,
      UserNote,
      UserCard,
      UserNoteDeck,
      ReviewEvent,
      UserProfile,
    ],
    name: ':memory:',
  });

describe('deckWrites', () => {
  let db: Database;
  const sync = { notifyLocalWrite: jest.fn() };

  beforeEach(async () => {
    db = await openDb();
    sync.notifyLocalWrite.mockClear();
  });
  afterEach(async () => {
    await db.driver.close();
  });

  it('creates, updates and removes a deck, waking sync each time', async () => {
    const writes = deckWrites(db, sync as never);

    const deck = await writes.create('Spanish', '', {
      noteType: 'basic',
      nativeLanguageId: null,
      targetLanguageId: null,
    });
    expect(await getDecksQuery(db).fetch()).toHaveLength(1);
    expect(deck.description).toBeNull();

    await writes.update(deck.id, 'Spanish verbs', 'Irregulars first');
    const [updated] = await getDecksQuery(db).fetch();
    expect(updated.title).toBe('Spanish verbs');
    expect(updated.description).toBe('Irregulars first');

    await writes.remove(deck.id);
    expect(await getDecksQuery(db).fetch()).toHaveLength(0);
    expect(sync.notifyLocalWrite).toHaveBeenCalledTimes(3);
  });

  it('removing a deck deletes the cards that are only in it', async () => {
    const writes = deckWrites(db, sync as never);
    const deck = await writes.create('Yoga', '', {
      noteType: 'basic',
      nativeLanguageId: null,
      targetLanguageId: null,
    });
    await createCard(db, deck.id, 'Tadasana', 'Mountain pose');
    expect(await getNoteDecksQuery(db).fetch()).toHaveLength(1);

    await writes.remove(deck.id);

    expect(await getNoteDecksQuery(db).fetch()).toHaveLength(0);
    expect(await db.get(UserCard).query().fetch()).toHaveLength(0);
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
  });

  // The dashboard's due count: selectDueCards over the personal dictionary.
  it('removing a deck takes its due cards out of the due count', async () => {
    const writes = deckWrites(db, sync as never);
    const deck = await writes.create('Yoga', '', {
      noteType: 'basic',
      nativeLanguageId: null,
      targetLanguageId: null,
    });
    await createCard(db, deck.id, 'Tadasana', 'Mountain pose');
    await activateWordsInDeck(db, deck.id, 1);
    const dueCount = async () =>
      selectDueCards(await getPersonalDictionaryQuery(db).fetch()).length;
    expect(await dueCount()).toBe(1);

    await writes.remove(deck.id);

    expect(await dueCount()).toBe(0);
  });

  it('removing a deck keeps a card that is also in another deck', async () => {
    const writes = deckWrites(db, sync as never);
    const options = {
      noteType: 'basic' as const,
      nativeLanguageId: null,
      targetLanguageId: null,
    };
    const deck = await writes.create('Yoga', '', options);
    const other = await writes.create('Morning routine', '', options);
    const card = await createCard(db, deck.id, 'Tadasana', 'Mountain pose');
    const now = Date.now();
    await db.write(async () =>
      db.get(UserNoteDeck).create({
        id: noteDeckId(card.note_id, other.id),
        note_id: card.note_id,
        deck_id: other.id,
        active: true,
        created_at: now,
        updated_at: now,
      }),
    );

    await writes.remove(deck.id);

    expect(await db.get(UserCard).find(card.id)).toBeTruthy();
    expect(
      (await getNoteDecksQuery(db).fetch()).map(
        (membership) => membership.deck_id,
      ),
    ).toEqual([other.id]);
  });
});
