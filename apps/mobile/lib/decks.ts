import { useCallback } from 'react';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getDecksQuery,
  getNoteDecksQuery,
  getPersonalDictionaryQuery,
  type UserCardRecord,
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
  const cards = useQuery<UserCardRecord>(db && getPersonalDictionaryQuery(db));

  // Active cards whose note is in the deck, the same count web shows. Not
  // the membership count: a note can carry several cards once sibling
  // templates land (#194), and a deactivated card should not be counted.
  const cardCount = useCallback(
    (deckId: string) => {
      const noteIds = new Set(
        memberships.data
          .filter((membership) => membership.deck_id === deckId)
          .map((membership) => membership.note_id),
      );
      return cards.data.filter((card) => noteIds.has(card.note_id)).length;
    },
    [cards.data, memberships.data],
  );

  return {
    db,
    decks: decks.data,
    isLoading: decks.isLoading || memberships.isLoading || cards.isLoading,
    error: decks.error ?? memberships.error ?? cards.error,
    cardCount,
    writes: db ? deckWrites(db, syncController) : null,
  };
}
