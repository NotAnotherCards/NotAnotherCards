import { useMemo } from 'react';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getDecksQuery,
  getNoteDecksQuery,
  getNotesQuery,
  getPersonalDictionaryQuery,
  type UserCardRecord,
  type UserDeckRecord,
  type UserNoteDeckRecord,
  type UserNoteRecord,
  WordNoteFieldsV1,
  WORD_NOTE_FIELDS_VERSION,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';
import { cardWrites } from './card-writes';
import { cardsForDeck, isBasicCard } from './cards-in-deck';
import { useSessionDatabase } from './database-provider';

export type Card = UserCardRecord;

// One deck's cards, reactive, plus the writes. Same shape as useDecks:
// subscribe to what the screen reads, derive the rest once per change.
export function useCards(manager: DatabaseManager, deckId: string) {
  const { syncController } = useSessionDatabase();
  const db = useDatabase(manager);
  const decks = useQuery<UserDeckRecord>(db && getDecksQuery(db));
  const memberships = useQuery<UserNoteDeckRecord>(db && getNoteDecksQuery(db));
  const cards = useQuery<UserCardRecord>(db && getPersonalDictionaryQuery(db));
  const notes = useQuery<UserNoteRecord>(db && getNotesQuery(db));

  const deck = useMemo(
    () => decks.data.find((d) => d.id === deckId) ?? null,
    [decks.data, deckId],
  );
  const deckCards = useMemo(
    () => cardsForDeck(memberships.data, cards.data, deckId),
    [memberships.data, cards.data, deckId],
  );
  const notesById = useMemo(
    () => new Map(notes.data.map((note) => [note.id, note])),
    [notes.data],
  );
  const noteForCard = (card: UserCardRecord) =>
    notesById.get(card.note_id) ?? null;
  const canEdit = (card: UserCardRecord) => {
    const note = noteForCard(card);
    if (isBasicCard(card, notesById)) return true;
    if (
      note?.note_type !== WORD_NOTE_TYPE ||
      note.fields_version !== WORD_NOTE_FIELDS_VERSION
    ) {
      return false;
    }
    try {
      return WordNoteFieldsV1.safeParse(JSON.parse(note.fields_json)).success;
    } catch {
      return false;
    }
  };

  return {
    db,
    deck,
    cards: deckCards,
    isLoading:
      decks.isLoading ||
      memberships.isLoading ||
      cards.isLoading ||
      notes.isLoading,
    error: decks.error ?? memberships.error ?? cards.error ?? notes.error,
    canEdit,
    noteForCard,
    writes: db ? cardWrites(db, syncController) : null,
  };
}
