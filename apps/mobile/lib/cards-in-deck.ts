import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  selectDueCards,
  type UserCardRecord,
  type UserNoteRecord,
} from '@repo/offline-db';

// Cards whose note is in the deck, in the cards' own order. Callers pass the
// active-only query results (getNoteDecksQuery, getPersonalDictionaryQuery);
// nothing is filtered here. The same join as web's getCardsForDeck; #241
// moves it into the package beside the shared countCardsPerDeck helper.
export function cardsForDeck<C extends { note_id: string }>(
  memberships: readonly { deck_id: string; note_id: string }[],
  cards: readonly C[],
  deckId: string,
): C[] {
  const noteIds = new Set<string>();
  for (const m of memberships) if (m.deck_id === deckId) noteIds.add(m.note_id);
  return cards.filter((card) => noteIds.has(card.note_id));
}

// Decks holding at least one due card. A deleted deck cannot appear: deleteDeck
// marks its membership rows deleted with it, and callers pass the active-only
// membership query, so this needs no separate deck-exists check.
export function decksWithDueCards(
  memberships: readonly { deck_id: string; note_id: string }[],
  cards: readonly UserCardRecord[],
  now: number = Date.now(),
): Set<string> {
  const dueNoteIds = new Set(
    selectDueCards(cards, now).map((card) => card.note_id),
  );
  const decks = new Set<string>();
  for (const m of memberships)
    if (dueNoteIds.has(m.note_id)) decks.add(m.deck_id);
  return decks;
}

// Only a basic note's front-back card is editable through the front/back
// form (web's rule). Anything else, once #194 adds note types, shows in the
// list but keeps its own editor.
export function isBasicCard(
  card: UserCardRecord,
  notesById: ReadonlyMap<string, UserNoteRecord>,
): boolean {
  const note = notesById.get(card.note_id);
  return (
    note?.note_type === BASIC_NOTE_TYPE &&
    note.fields_version === BASIC_NOTE_FIELDS_VERSION &&
    card.template_key === BASIC_FRONT_BACK_TEMPLATE_KEY
  );
}
