import { useMemo } from 'react';
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
import { cardsForDeck } from './cards-in-deck';
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
  const due = selectDueCards(cards.data, now);
  const dueNoteIds = new Set(due.map((card) => card.note_id));
  // Decks with at least one due card: the Start review button only opens a
  // deck that has work, whatever the saved preference says.
  const dueDeckIds = new Set(
    memberships.data
      .filter((row) => dueNoteIds.has(row.note_id))
      .map((row) => row.deck_id),
  );

  return {
    dueDeckIds,
    dueCount: due.length,
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

  return {
    deck,
    dueCards,
    isLoading: decks.isLoading || memberships.isLoading || cards.isLoading,
    error: decks.error ?? memberships.error ?? cards.error,
    writes,
  };
}
