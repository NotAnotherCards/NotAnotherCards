import { useCallback, useMemo } from 'react';
import type {
  Database,
  DatabaseManager,
  SyncController,
} from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getDecksQuery,
  getNoteDecksQuery,
  getPersonalDictionaryQuery,
  recordReviewEvent,
  selectDueCards,
  type ReviewRating,
  type UserCardRecord,
  type UserDeckRecord,
  type UserNoteDeckRecord,
} from '@repo/offline-db';
import { cardsForDeck, decksWithDueCards } from './cards-in-deck';
import { useSessionDatabase } from './database-provider';

export function dueCardsForDeck(
  memberships: readonly Pick<UserNoteDeckRecord, 'deck_id' | 'note_id'>[],
  cards: readonly UserCardRecord[],
  deckId: string,
  now: number = Date.now(),
): UserCardRecord[] {
  return selectDueCards(cardsForDeck(memberships, cards, deckId), now);
}

export function reviewWrites(db: Database, sync: SyncController | null) {
  return {
    record: async (cardId: string, rating: ReviewRating) => {
      const review = await recordReviewEvent(db, cardId, rating);
      sync?.notifyLocalWrite();
      return review;
    },
  };
}

export function useReviewOverview(manager: DatabaseManager) {
  const db = useDatabase(manager);
  const memberships = useQuery<UserNoteDeckRecord>(db && getNoteDecksQuery(db));
  const cards = useQuery<UserCardRecord>(db && getPersonalDictionaryQuery(db));

  const now = Date.now();

  return {
    dueDeckIds: decksWithDueCards(memberships.data, cards.data, now),
    dueCount: selectDueCards(cards.data, now).length,
    isLoading: !db || memberships.isLoading || cards.isLoading,
    error: memberships.error ?? cards.error,
  };
}

export function useReviewDeck(manager: DatabaseManager, deckId: string) {
  const { syncController } = useSessionDatabase();
  const db = useDatabase(manager);
  const decks = useQuery<UserDeckRecord>(db && getDecksQuery(db));
  const memberships = useQuery<UserNoteDeckRecord>(db && getNoteDecksQuery(db));
  const cards = useQuery<UserCardRecord>(db && getPersonalDictionaryQuery(db));

  const deck = useMemo(
    () => decks.data.find((item) => item.id === deckId) ?? null,
    [deckId, decks.data],
  );
  const dueCards = useMemo(
    () => dueCardsForDeck(memberships.data, cards.data, deckId),
    [cards.data, deckId, memberships.data],
  );
  const writes = useMemo(
    () => (db ? reviewWrites(db, syncController) : null),
    [db, syncController],
  );

  // The rendered `dueCards` are a snapshot of the last query result, so a
  // batch built from them misses anything that became due, synced in or was
  // deleted since. This reads the database at the moment it is called.
  const readDueCards = useCallback(async () => {
    if (!db) return [];
    const [memberRows, cardRows] = await Promise.all([
      getNoteDecksQuery(db).fetch(),
      getPersonalDictionaryQuery(db).fetch(),
    ]);
    return dueCardsForDeck(memberRows, cardRows, deckId);
  }, [db, deckId]);

  return {
    deck,
    dueCards,
    readDueCards,
    isLoading: decks.isLoading || memberships.isLoading || cards.isLoading,
    error: decks.error ?? memberships.error ?? cards.error,
    writes,
  };
}
