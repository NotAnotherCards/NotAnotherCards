import { selectDueCards, type ReviewQueueCard } from './review-queue.js';

// Cards per deck, counted once for every deck instead of rescanning both
// lists per rendered deck. Callers pass active-only query results, so nothing
// is filtered here. A note can carry several cards and sit in several decks;
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
  const dueDeckIds = [...counts]
    .filter(([, count]) => count > 0)
    .map(([id]) => id);
  if (dueDeckIds.length === 1) return dueDeckIds[0]!;
  return dueDeckIds.length > 0 ? 'library' : 'nothing-due';
}
