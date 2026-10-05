import { useMemo } from 'react';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  countCardsPerDeck,
  deckLearningCounts,
  getAllCardsQuery,
  getDecksQuery,
  getNoteDecksQuery,
  getUserProfileQuery,
  selectDueCards,
  type DeckLearningCounts,
  type UserCardRecord,
  type UserDeckRecord,
  type UserNoteDeckRecord,
  type UserProfileRecord,
} from '@repo/offline-db';
import { deckWrites } from './deck-writes';
import { useSessionDatabase } from './database-provider';
import { useNow } from './use-now';

export type Deck = UserDeckRecord;

// Web's figures plus the cards still waiting to be activated, which the
// review screen offers once nothing is due.
type DeckCounts = DeckLearningCounts & { inactiveCards: number };

const NO_LEARNING: DeckCounts = {
  inactiveCards: 0,
  totalCards: 0,
  activeCards: 0,
  dueCards: 0,
  totalNotes: 0,
  activeNotes: 0,
};

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

  // The same count over the due cards only, so the list shows where the work
  // is. The Overview's total (#381) is the sum across decks. Recounted as the
  // clock moves too: a card coming due changes no data, so the list would
  // otherwise keep 0 and Start Review stay off until something reloads it.
  // A data change recounts with the current time, not the last tick's:
  // activating stamps a card due "now", up to a minute after that tick, and
  // the deck must count it at once, or Review stays off while it has work.
  const now = useNow();
  const dueCounts = useMemo(
    () =>
      countCardsPerDeck(
        memberships.data,
        selectDueCards(cards.data, Math.max(now, Date.now())),
      ),
    [cards.data, memberships.data, now],
  );
  const dueCount = (deckId: string) => dueCounts.get(deckId) ?? 0;

  // Web's deck tile figures: a deck's notes and cards, and how many of each
  // are active. Grouped once for every deck, like the counts above.
  const learningCounts = useMemo(() => {
    const cardsPerNote = new Map<string, UserCardRecord[]>();
    for (const card of cards.data) {
      const siblings = cardsPerNote.get(card.note_id);
      if (siblings) siblings.push(card);
      else cardsPerNote.set(card.note_id, [card]);
    }
    const notesPerDeck = new Map<string, string[]>();
    for (const { deck_id, note_id } of memberships.data) {
      const noteIds = notesPerDeck.get(deck_id);
      if (noteIds) noteIds.push(note_id);
      else notesPerDeck.set(deck_id, [note_id]);
    }
    const counts = new Map<string, DeckCounts>();
    for (const [deckId, noteIds] of notesPerDeck) {
      const deckCards = noteIds.flatMap((id) => cardsPerNote.get(id) ?? []);
      counts.set(deckId, {
        ...deckLearningCounts(deckCards, noteIds),
        inactiveCards: deckCards.filter((card) => !card.active).length,
      });
    }
    return counts;
  }, [cards.data, memberships.data]);
  const learning = (deckId: string) =>
    learningCounts.get(deckId) ?? NO_LEARNING;

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
    dueCount,
    learning,
    profile: profiles.data[0] ?? null,
    writes: db ? deckWrites(db, syncController) : null,
  };
}
