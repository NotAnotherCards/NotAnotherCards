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

// Cards whose note is in the deck, in the cards' own order. The same join as
// countCardsPerDeck for one deck; callers pass active-only query results,
// and nothing is filtered here.
export function cardsForDeck<C extends { note_id: string }>(
  memberships: readonly { deck_id: string; note_id: string }[],
  cards: readonly C[],
  deckId: string,
): C[] {
  const noteIds = new Set<string>();
  for (const m of memberships) if (m.deck_id === deckId) noteIds.add(m.note_id);
  return cards.filter((card) => noteIds.has(card.note_id));
}
