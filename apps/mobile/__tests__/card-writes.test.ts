import { Database, Q } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  schema,
  UserDeck,
  UserNote,
  UserCard,
  UserNoteDeck,
  ReviewEvent,
  UserProfile,
  createDeck,
  getNoteDecksQuery,
  getPersonalDictionaryQuery,
  recordReviewEvent,
} from '@repo/offline-db';
import { cardWrites } from '@/lib/card-writes';

// Same harness as deck-writes: the writes are shared, the sync wake-up is
// mobile's, and the data model's two removal scopes are what the cases pin.
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

describe('cardWrites', () => {
  let db: Database;
  const sync = { notifyLocalWrite: jest.fn() };

  beforeEach(async () => {
    db = await openDb();
    sync.notifyLocalWrite.mockClear();
  });
  afterEach(async () => {
    await db.driver.close();
  });

  it('creates a note, its card and the deck membership, then updates the card', async () => {
    const deck = await createDeck(db, 'Spanish', null);
    const writes = cardWrites(db, sync as never);

    const card = await writes.create(deck.id, 'hola', 'hello');
    expect(card.front).toBe('hola');
    expect(await db.get(UserNote).find(card.note_id)).toBeTruthy();
    expect(await getNoteDecksQuery(db).fetch()).toHaveLength(1);

    await writes.update(card.id, 'hola!', 'hello!');
    const [updated] = await getPersonalDictionaryQuery(db).fetch();
    expect(updated.front).toBe('hola!');
    expect(updated.back).toBe('hello!');
    expect(sync.notifyLocalWrite).toHaveBeenCalledTimes(2);
  });

  it('removing from a deck ends the membership and keeps the note and card', async () => {
    const deck = await createDeck(db, 'Spanish', null);
    const writes = cardWrites(db, sync as never);
    const card = await writes.create(deck.id, 'hola', 'hello');

    await writes.removeFromDeck(card.note_id, deck.id);

    expect(await getNoteDecksQuery(db).fetch()).toHaveLength(0);
    expect(await getPersonalDictionaryQuery(db).fetch()).toHaveLength(1);
    expect(await db.get(UserNote).find(card.note_id)).toBeTruthy();
    expect(sync.notifyLocalWrite).toHaveBeenCalledTimes(2);
  });

  it('deleting a note takes its card, memberships and review history with it', async () => {
    const deck = await createDeck(db, 'Spanish', null);
    const writes = cardWrites(db, sync as never);
    const card = await writes.create(deck.id, 'hola', 'hello');
    await recordReviewEvent(db, card.id, 3);
    expect(await db.get(ReviewEvent).query().fetch()).toHaveLength(1);

    await writes.deleteNote(card.note_id);

    expect(await getPersonalDictionaryQuery(db).fetch()).toHaveLength(0);
    expect(await getNoteDecksQuery(db).fetch()).toHaveLength(0);
    expect(
      await db.get(ReviewEvent).query(Q.where('user_card_id', card.id)).fetch(),
    ).toHaveLength(0);
    expect(sync.notifyLocalWrite).toHaveBeenCalledTimes(2);
  });

  it('does not wake sync when a write rejects', async () => {
    const writes = cardWrites(db, sync as never);
    await expect(writes.update('missing-card', 'x', 'y')).rejects.toThrow();
    expect(sync.notifyLocalWrite).not.toHaveBeenCalled();
  });
});
