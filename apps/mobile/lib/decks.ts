import { useMemo } from 'react';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getDecksQuery,
  getNoteDecksQuery,
  getPersonalDictionaryQuery,
  getUserProfileQuery,
  type UserCardRecord,
  type UserDeckRecord,
  type UserNoteDeckRecord,
  type UserProfileRecord,
} from '@repo/offline-db';
import { countCardsPerDeck } from './card-counts';
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
  const cards = useQuery<UserCardRecord>(db && getPersonalDictionaryQuery(db));
  const profiles = useQuery<UserProfileRecord>(db && getUserProfileQuery(db));

  // Active cards whose note is in the deck, the same count web shows. Not
  // the membership count: a note can carry several cards once sibling
  // templates land (#194), and both queries are already active-only.
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
