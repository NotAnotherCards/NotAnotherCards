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
  for (const note of notes) {
    if (
      note.note_type !== BASIC_NOTE_TYPE ||
      note.fields_version !== BASIC_NOTE_FIELDS_VERSION
    ) {
      throw new Error('CSV export only supports basic@1 notes');
    }
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

  const cardsMap = new Map<string, typeof cards[0]>();
  for (const c of cards) {
    if (!cardsMap.has(c.note_id)) {
      cardsMap.set(c.note_id, c);
    }
  }

  for (const note of notes) {
    let front = '';
    let back = '';
    try {
      const parsed = JSON.parse(note.fields_json);
      front = parsed.front ?? '';
      back = parsed.back ?? '';
    } catch {
      front = '';
      back = '';
    }
    const activeDeckIds = noteDecksMap.get(note.id) ?? [];

    const deckName = activeDeckIds
      .map((id) => deckTitleMap.get(id))
      .filter(Boolean)
      .join('; ');

    const card = cardsMap.get(note.id);
    const active = card ? card.active : true;
    const dueAt = card ? card.due_at : Date.now();
    const interval = card ? card.scheduled_interval_minutes : 0;

    const row = [
      escapeCsvField(front),
      escapeCsvField(back),
      escapeCsvField(deckName),
      escapeCsvField(active),
      escapeCsvField(dueAt),
      escapeCsvField(interval),
    ];
    rows.push(row.join(','));
  }
  return rows.join('\n');
}
