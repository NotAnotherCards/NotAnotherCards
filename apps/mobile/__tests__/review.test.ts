import { Database } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  createCard,
  createDeck,
  getReviewHistoryQuery,
  ReviewEvent,
  schema,
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
  UserProfile,
  type UserCardRecord,
} from '@repo/offline-db';
import { dueCardsForDeck, reviewWrites } from '@/lib/review';

jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ syncController: null }),
}));

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

describe('mobile review data', () => {
  it('selects only due cards from the requested deck in due order', () => {
    const card = (id: string, noteId: string, dueAt: number): UserCardRecord =>
      ({ id, note_id: noteId, due_at: dueAt }) as UserCardRecord;
    const cards = [
      card('later', 'n1', 20),
      card('future', 'n2', 31),
      card('first', 'n3', 10),
      card('other-deck', 'n4', 5),
    ];
    const memberships = [
      { deck_id: 'd1', note_id: 'n1' },
      { deck_id: 'd1', note_id: 'n2' },
      { deck_id: 'd1', note_id: 'n3' },
      { deck_id: 'd2', note_id: 'n4' },
    ];

    expect(
      dueCardsForDeck(memberships, cards, 'd1', 30).map((c) => c.id),
    ).toEqual(['first', 'later']);
  });

  it('records through the shared scheduler and wakes sync', async () => {
    const db = await openDb();
    const sync = { notifyLocalWrite: jest.fn() };
    try {
      const deck = await createDeck(db, 'Spanish');
      const card = await createCard(db, deck.id, 'hola', 'hello');

      await reviewWrites(db, sync as never).record(card.id, 3);

      expect(await getReviewHistoryQuery(db, card.id).fetch()).toHaveLength(1);
      expect((await db.get(UserCard).find(card.id)).due_at).toBeGreaterThan(
        Date.now(),
      );
      expect(sync.notifyLocalWrite).toHaveBeenCalledTimes(1);
    } finally {
      await db.driver.close();
    }
  });
});
