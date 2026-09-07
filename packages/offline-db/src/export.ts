import { Database } from '@remelondb/core';
import {
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
  ReviewEvent,
} from './user-dictionary.js';
import {
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
} from './note-constants.js';
import {
  BackupCard,
  BackupDeck,
  BackupJsonFormat,
  BackupNote,
  BackupReviewEvent,
} from './export-import-types.js';
import { compileNote } from './note-registry.js';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportDataToJson(
  db: Database,
): Promise<BackupJsonFormat> {
  const decks = await db.get(UserDeck).query().fetch();
  const notes = await db.get(UserNote).query().fetch();
  const cards = await db.get(UserCard).query().fetch();
  const noteDecks = await db.get(UserNoteDeck).query().fetch();
  const reviewEvents = await db.get(ReviewEvent).query().fetch();

  const exportedDecks: BackupDeck[] = decks.map((deck) => ({
    source_id: deck.id,
    title: deck.title,
    description: deck.description ?? null,
    note_type: deck.note_type,
    native_language: deck.native_language_id ?? null,
    target_language: deck.target_language_id ?? null,
  }));

  const noteDecksMap = new Map<string, string[]>();
  for (const nd of noteDecks) {
    if (nd.active) {
      const list = noteDecksMap.get(nd.note_id) ?? [];
      list.push(nd.deck_id);
      noteDecksMap.set(nd.note_id, list);
    }
  }

  const cardsMap = new Map<string, typeof cards>();
  for (const c of cards) {
    const list = cardsMap.get(c.note_id) ?? [];
    list.push(c);
    cardsMap.set(c.note_id, list);
  }

  const exportedNotes: BackupNote[] = notes.map((note) => {
    const activeDeckIds = noteDecksMap.get(note.id) ?? [];
    const noteCards: BackupCard[] = (cardsMap.get(note.id) ?? []).map((c) => ({
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

  const exportedReviewEvents: BackupReviewEvent[] = reviewEvents.map((re) => ({
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

export async function exportDataToCsv(db: Database): Promise<string> {
  const notes = await db.get(UserNote).query().fetch();
  const cards = await db.get(UserCard).query().fetch();
  const noteDecks = await db.get(UserNoteDeck).query().fetch();
  const decks = await db.get(UserDeck).query().fetch();

  const deckTitleMap = new Map<string, string>();
  for (const d of decks) {
    deckTitleMap.set(d.id, d.title);
  }

  const header = [
    'front',
    'back',
    'deck',
    'active',
    'due_at',
    'scheduled_interval_minutes',
  ];
  const rows: string[] = [header.join(',')];

  const noteDecksMap = new Map<string, string[]>();
  for (const nd of noteDecks) {
    if (nd.active) {
      const list = noteDecksMap.get(nd.note_id) ?? [];
      list.push(nd.deck_id);
      noteDecksMap.set(nd.note_id, list);
    }
  }

  const cardsByNote = new Map<string, typeof cards>();
  for (const c of cards) {
    const list = cardsByNote.get(c.note_id) ?? [];
    list.push(c);
    cardsByNote.set(c.note_id, list);
  }

  for (const note of notes) {
    const activeDeckIds = noteDecksMap.get(note.id) ?? [];
    const deckName = activeDeckIds
      .map((id) => deckTitleMap.get(id))
      .filter(Boolean)
      .join('; ');

    let compiledCards: readonly {
      templateKey: string;
      front: string;
      back: string;
    }[] = [];
    try {
      let fields: unknown = {};
      try {
        fields = JSON.parse(note.fields_json);
      } catch {
        fields = {};
      }
      compiledCards = compileNote(
        note.note_type,
        note.fields_version,
        fields,
      ).cards;
    } catch {
      continue; // Skip invalid notes
    }

    const compiledMap = new Map(compiledCards.map((c) => [c.templateKey, c]));
    const noteCards = cardsByNote.get(note.id) ?? [];

    for (const card of noteCards) {
      const compiledCard = compiledMap.get(card.template_key);
      if (!compiledCard) continue;

      const row = [
        escapeCsvField(compiledCard.front),
        escapeCsvField(compiledCard.back),
        escapeCsvField(deckName),
        escapeCsvField(card.active),
        escapeCsvField(card.due_at),
        escapeCsvField(card.scheduled_interval_minutes),
      ];
      rows.push(row.join(','));
    }
  }
  return rows.join('\n');
}
