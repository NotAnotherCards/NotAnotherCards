import { useCallback } from 'react';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getDecksQuery,
  getNoteDecksQuery,
  type UserDeckRecord,
  type UserNoteDeckRecord,
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

  // One front-back card per basic note today, so active memberships count
  // the deck's cards; revisit when notes gain sibling templates (#194).
  const cardCount = useCallback(
    (deckId: string) =>
      memberships.data.filter((membership) => membership.deck_id === deckId)
        .length,
    [memberships.data],
  );

  return {
    db,
    decks: decks.data,
    isLoading: decks.isLoading || memberships.isLoading,
    error: decks.error ?? memberships.error,
    cardCount,
    writes: db ? deckWrites(db, syncController) : null,
  };
}
