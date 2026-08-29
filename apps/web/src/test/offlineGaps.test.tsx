/**
 * Failing tests for two gaps in the offline store wiring. Both run against a
 * real in-memory SQLite database (@remelondb/driver-node), so they exercise
 * the actual query and write paths, not mocks.
 *
 * 1. The due-cards list never picks up cards that become due while the app
 *    is open: getDueCardsQuery captures Date.now() once, and useStore only
 *    rebuilds the query when the db instance changes.
 * 2. Deleting a deck is a membership-only cascade: its notes, cards, and
 *    review history must stay in the personal dictionary.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  Database,
  Q,
  fetchLocalChanges,
  markLocalChangesAsSynced,
} from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  schema,
  UserDeck,
  UserNote,
  UserCard,
  UserNoteDeck,
  ReviewEvent,
  cardId as deriveCardId,
  noteDeckId as deriveNoteDeckId,
} from '@repo/offline-db';
import { useStore } from '@/hooks/useStore';
import { DatabaseProvider } from '@remelondb/core/react';
import {
  createDeck,
  createCard,
  recordReviewEvent,
  deleteDeck,
  getDeckCardsQuery,
  getReviewHistoryQuery,
} from '@/offline/queries';

// `var` is intentional: vitest hoists mock factories above lexical
// declarations, and the tests need the manager the factory built.
// eslint-disable-next-line no-var
var testManager: ReturnType<
  typeof import('@remelondb/core').createDatabaseManager
>;

vi.mock('../offline/db', async () => {
  const { createDatabaseManager, Database } = await import('@remelondb/core');
  const { NodeSqliteDriver } = await import('@remelondb/driver-node');
  const { schema, UserDeck, UserNote, UserCard, UserNoteDeck, ReviewEvent } =
    await import('@repo/offline-db');
  testManager = createDatabaseManager({
    open: () =>
      Database.open({
        driver: new NodeSqliteDriver(),
        schema,
        modelClasses: [UserDeck, UserNote, UserCard, UserNoteDeck, ReviewEvent],
        name: ':memory:',
      }),
  });
  return { createUserDatabaseManager: () => testManager };
});

describe('due-cards reactivity', () => {
  beforeEach(() => {
    // Fake only Date so vi.setSystemTime works; timers stay real for waitFor.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-06T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a card again once its 'Again' interval has elapsed", async () => {
    const { createUserDatabaseManager } = await import('../offline/db');
    const manager = createUserDatabaseManager('user-a');
    await manager.init();
    const { result, rerender } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={manager}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let deckId = '';
    let cardId = '';
    await act(async () => {
      const deck = await result.current.createDeck('Deck', '');
      deckId = deck.id;
      const card = await result.current.createCard(deckId, 'front', 'back');
      cardId = card.id;
    });

    // The freshly created card is due immediately.
    await waitFor(() =>
      expect(result.current.dueCards.map((c) => c.id)).toContain(cardId),
    );

    // Rate it "Again" -> due again five minutes from now.
    await act(async () => {
      await result.current.recordReview(cardId, 1);
    });
    await waitFor(() => expect(result.current.dueCards).toHaveLength(0));

    // Six minutes pass while the app stays open.
    vi.setSystemTime(Date.now() + 6 * 60_000);
    rerender();

    // Intended behavior: the card is due again and reappears without a page
    // reload. Currently the query keeps the Date.now() captured at build
    // time, so this times out.
    await waitFor(
      () => expect(result.current.dueCards.map((c) => c.id)).toContain(cardId),
      { timeout: 2000 },
    );
  });
});

describe('deck deletion on the wire', () => {
  it('ships a deck deletion as a protocol delete, not an update', async () => {
    const db = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserNote, UserCard, UserNoteDeck, ReviewEvent],
      name: ':memory:',
    });

    const deck = await createDeck(db, 'Deck');

    // Simulate a completed push so the deck is in synced state - deletions
    // of never-synced records don't need a tombstone.
    const localChanges = await fetchLocalChanges(db);
    await db.write(async () => {
      await markLocalChangesAsSynced(db, localChanges);
    });

    await deleteDeck(db, deck.id);

    // Intended behavior: the deletion lands in the wire `deleted` list, so
    // the server writes a tombstone. Writing deleted_at as an app column
    // makes it an `updated` entry instead - the server would upsert the
    // deck alive again and every device would resurrect it on the next
    // pull.
    const { changes } = await fetchLocalChanges(db);
    expect(changes.user_decks.deleted).toContain(deck.id);
    expect(changes.user_decks.updated.map((r) => r.id)).not.toContain(deck.id);
  });
});

describe('deck deletion cascade', () => {
  it('removes memberships while preserving notes, cards, and reviews', async () => {
    const db = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserNote, UserCard, UserNoteDeck, ReviewEvent],
      name: ':memory:',
    });

    const deck = await createDeck(db, 'Deck');
    const card = await createCard(db, deck.id, 'front', 'back');
    expect(card.id).toBe(deriveCardId(card.note_id, card.template_key));
    expect(card.scheduled_interval_minutes).toBe(0);
    const [membership] = await db
      .get(UserNoteDeck)
      .query(Q.where('note_id', card.note_id), Q.where('deck_id', deck.id))
      .fetch();
    expect(membership?.id).toBe(deriveNoteDeckId(card.note_id, deck.id));
    await recordReviewEvent(db, card.id, 3);

    expect(await getDeckCardsQuery(db, deck.id).fetch()).toHaveLength(1);

    await deleteDeck(db, deck.id);

    const reviews = await getReviewHistoryQuery(db).fetch();
    expect(reviews).toHaveLength(1);
    expect(await db.get(UserCard).find(card.id)).toBeDefined();
    expect(await db.get(UserNote).find(card.note_id)).toBeDefined();
    expect(await getDeckCardsQuery(db, deck.id).fetch()).toEqual([]);
    expect(
      await db.get(UserNoteDeck).query(Q.where('deck_id', deck.id)).fetch(),
    ).toEqual([]);
  });
});
