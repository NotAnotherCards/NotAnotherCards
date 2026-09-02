// Cards per deck, counted once for every deck instead of rescanning both
// lists per rendered deck. Callers pass the active-only query results
// (getNoteDecksQuery, getPersonalDictionaryQuery), so nothing is filtered
// here. A note can carry several cards and sit in several decks; each deck
// counts every card of every note it holds.
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
