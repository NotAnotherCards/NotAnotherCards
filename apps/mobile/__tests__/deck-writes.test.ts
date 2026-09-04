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
  createCard,
  getNoteDecksQuery,
} from '@repo/offline-db';
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

    const deck = await writes.create('Spanish', '');
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

  it('removing a deck drops its memberships but keeps the cards', async () => {
    const writes = deckWrites(db, sync as never);
    const deck = await writes.create('Yoga', '');
    const card = await createCard(db, deck.id, 'Tadasana', 'Mountain pose');
    expect(await getNoteDecksQuery(db).fetch()).toHaveLength(1);

    await writes.remove(deck.id);

    expect(await getNoteDecksQuery(db).fetch()).toHaveLength(0);
    expect(await db.get(UserCard).find(card.id)).toBeTruthy();
  });
});
