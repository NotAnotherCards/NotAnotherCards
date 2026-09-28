import { useMemo } from 'react';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  countCardsPerDeck,
  getAllCardsQuery,
  getDecksQuery,
  getNoteDecksQuery,
  getUserProfileQuery,
  type UserCardRecord,
  type UserDeckRecord,
  type UserNoteDeckRecord,
  type UserProfileRecord,
} from '@repo/offline-db';
import { deckWrites } from './deck-writes';
import { useSessionDatabase } from './database-provider';

export type Deck = UserDeckRecord;

// Reactive decks plus the per-deck card count. Callers pass the manager
// from useSessionDatabase(), so this is only rendered once it exists (see
// the readiness note on #68).
export function useDecks(manager: DatabaseManager) {
  const { syncController } = useSessionDatabase();
  const db = useDatabase(manager);
  const decks = useQuery<UserDeckRecord>(db && getDecksQuery(db));
  const memberships = useQuery<UserNoteDeckRecord>(db && getNoteDecksQuery(db));
  const cards = useQuery<UserCardRecord>(db && getAllCardsQuery(db));
  const profiles = useQuery<UserProfileRecord>(db && getUserProfileQuery(db));

  // Every card whose note is in the deck. A note can carry several siblings.
  const cardCounts = useMemo(
    () => countCardsPerDeck(memberships.data, cards.data),
    [cards.data, memberships.data],
  );
  const cardCount = (deckId: string) => cardCounts.get(deckId) ?? 0;

  return {
    db,
    decks: decks.data,
    isLoading:
      decks.isLoading ||
      memberships.isLoading ||
      cards.isLoading ||
      profiles.isLoading,
    error: decks.error ?? memberships.error ?? cards.error ?? profiles.error,
    cardCount,
    profile: profiles.data[0] ?? null,
    writes: db ? deckWrites(db, syncController) : null,
  };
}
