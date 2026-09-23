export function countWords(notes: readonly unknown[]): number {
  return notes.length;
}

export function countCards(cards: readonly unknown[]): number {
  return cards.length;
}

export function countDueCards<
  TCard extends { id: string },
  TDueCard extends { id: string },
>(cards: readonly TCard[], dueCards: readonly TDueCard[]): number {
  const dueIds = new Set(dueCards.map((card) => card.id));
  return cards.filter((card) => dueIds.has(card.id)).length;
}
