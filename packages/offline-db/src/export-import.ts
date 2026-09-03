import { Database } from '@remelondb/core';
import {
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
  ReviewEvent,
} from './user-dictionary.js';

interface ExportJsonFormat {
  format: number;
  exported_at: string;
  decks: ExportDeck[];
  notes: ExportNote[];
  review_events: ExportReviewEvent[];
  media: unknown[];
}

interface ExportDeck {
  source_id: string;
  title: string;
  description: string | null;
}

interface ExportNote {
  source_id: string;
  note_type: string;
  fields_version: number;
  fields: Record<string, string>;
  additional_content: string | null;
  decks: string[];
  cards: ExportCard[];
}

interface ExportCard {
  source_id: string;
  template_key: string;
  active: boolean;
  due_at: number;
  scheduled_interval_minutes: number;
}

interface ExportReviewEvent {
  source_card_id: string;
  rating: number;
  reviewed_at: number;
}

export async function exportDataToJson(
  db: Database,
): Promise<ExportJsonFormat> {
  const decks = await db.get(UserDeck).query().fetch();
  const notes = await db.get(UserNote).query().fetch();
  const cards = await db.get(UserCard).query().fetch();
  const noteDecks = await db.get(UserNoteDeck).query().fetch();
  const reviewEvents = await db.get(ReviewEvent).query().fetch();

  const exportedDecks: ExportDeck[] = decks.map((deck) => ({
    source_id: deck.id,
    title: deck.title,
    description: deck.description ?? null,
  }));

  const exportedNotes: ExportNote[] = notes.map((note) => {
    const activeDeckIds = noteDecks
      .filter((nd) => nd.note_id === note.id && nd.active)
      .map((nd) => nd.deck_id);
    const noteCards: ExportCard[] = cards
      .filter((c) => c.note_id === note.id)
      .map((c) => ({
        source_id: c.id,
        template_key: c.template_key,
        active: c.active,
        due_at: c.due_at,
        scheduled_interval_minutes: c.scheduled_interval_minutes,
      }));
    let parsedFields: Record<string, string> = {};
    try {
      parsedFields = JSON.parse(note.fields_json);
    } catch {
      parsedFields = {};
    }
    return {
      source_id: note.id,
      note_type: note.note_type,
      fields_version: note.fields_version,
      fields: parsedFields,
      additional_content: note.additional_content ?? null,
      decks: activeDeckIds,
      cards: noteCards,
    };
  });

  const exportedReviewEvents: ExportReviewEvent[] = reviewEvents.map((re) => ({
    source_card_id: re.user_card_id,
    rating: re.rating,
    reviewed_at: re.reviewed_at,
  }));
  return {
    format: 1,
    exported_at: new Date().toISOString(),
    decks: exportedDecks,
    notes: exportedNotes,
    review_events: exportedReviewEvents,
    media: [],
  };
}

export function exportDataToCsv(db: Database) {}
