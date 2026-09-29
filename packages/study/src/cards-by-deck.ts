import { selectDueCards, type ReviewQueueCard } from './review-queue.js';

export type DeckLearningCounts = {
  totalCards: number;
  activeCards: number;
  dueCards: number;
  totalNotes: number;
  activeNotes: number;
};

/** Counts one deck's cards and notes from the same card state as review. */
export function deckLearningCounts(
  cards: readonly ReviewQueueCard[],
  noteIds: readonly string[] = cards.map((card) => card.note_id),
  now: number = Date.now(),
): DeckLearningCounts {
  const noteIdSet = new Set(noteIds);
  const activeNoteIds = new Set(
    cards.filter((card) => card.active !== false).map((card) => card.note_id),
  );
  return {
    totalCards: cards.length,
    activeCards: cards.filter((card) => card.active !== false).length,
    dueCards: selectDueCards(cards, now).length,
    totalNotes: noteIdSet.size,
    activeNotes: [...noteIdSet].filter((id) => activeNoteIds.has(id)).length,
  };
}

// Cards per deck, counted once for every deck instead of rescanning both
// lists per rendered deck. The caller chooses which cards to include. A note
// can carry several cards and sit in several decks;
// each deck counts every card of every note it holds.
export function countCardsPerDeck(
  memberships: readonly { deck_id: string; note_id: string }[],
  cards: readonly { note_id: string }[],
): Map<string, number> {
  const cardsPerNote = new Map<string, number>();
  for (const card of cards) {
    cardsPerNote.set(card.note_id, (cardsPerNote.get(card.note_id) ?? 0) + 1);
  }

  const counts = new Map<string, number>();
  for (const { deck_id, note_id } of memberships) {
    counts.set(
      deck_id,
      (counts.get(deck_id) ?? 0) + (cardsPerNote.get(note_id) ?? 0),
    );
  }
  return counts;
}

// Cards whose note is in the deck, in the cards' own order. The same join as
// countCardsPerDeck for one deck; nothing is filtered here.
export function cardsForDeck<C extends { note_id: string }>(
  memberships: readonly { deck_id: string; note_id: string }[],
  cards: readonly C[],
  deckId: string,
): C[] {
  const noteIds = new Set<string>();
  for (const m of memberships) if (m.deck_id === deckId) noteIds.add(m.note_id);
  return cards.filter((card) => noteIds.has(card.note_id));
}

// The deck Start review opens, per #425's four rules. `cards` includes active
// and inactive cards so a remembered deck with new words can open its review.
export function reviewTarget({
  lastDeckId,
  memberships,
  cards,
  now,
}: {
  lastDeckId: string | null;
  memberships: readonly { deck_id: string; note_id: string }[];
  cards: readonly ReviewQueueCard[];
  now: number;
}): string | 'library' | 'nothing-due' {
  const counts = countCardsPerDeck(memberships, selectDueCards(cards, now));
  if (lastDeckId && (counts.get(lastDeckId) ?? 0) > 0) return lastDeckId;
  const inactiveNoteIds = new Set(
    cards.filter((card) => card.active === false).map((card) => card.note_id),
  );
  if (
    lastDeckId &&
    memberships.some(
      (membership) =>
        membership.deck_id === lastDeckId &&
        inactiveNoteIds.has(membership.note_id),
    )
  ) {
    return lastDeckId;
  }
  const dueDeckIds = [...counts]
    .filter(([, count]) => count > 0)
    .map(([id]) => id);
  if (dueDeckIds.length === 1) return dueDeckIds[0]!;
  return dueDeckIds.length > 0 ? 'library' : 'nothing-due';
}
