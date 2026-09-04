import { Database, randomId, type BatchOperation } from '@remelondb/core';
import { cardId, noteDeckId } from './ids.js';
import {
  BASIC_NOTE_TYPE,
  BASIC_NOTE_FIELDS_VERSION,
} from './note-constants.js';
import {
  UserDeck,
  UserNote,
  UserCard,
  UserNoteDeck,
  ReviewEvent,
} from './user-dictionary.js';
import type {
  BackupJsonFormat,
  BackupDeck,
  BackupNote,
  BackupCard,
  BackupReviewEvent,
} from './export-import-types.js';

export interface ImportError {
  row?: number;
  path?: string;
  code: string;
  message: string;
}

export interface ImportCounts {
  decks: number;
  notes: number;
  cards: number;
  review_events: number;
}

export interface ImportReport {
  success: boolean;
  dry_run: boolean;
  counts: ImportCounts;
  errors: ImportError[];
}

export interface ImportOptions {
  format: 'json' | 'csv';
  dryRun?: boolean;
}

export async function validateAndImportData(
  db: Database,
  content: string,
  options: ImportOptions,
): Promise<ImportReport> {
  if (options.format === 'json') {
    return validateAndImportJson(db, content, options.dryRun ?? false);
  } else {
    return validateAndImportCsv(db, content, options.dryRun ?? false);
  }
}

async function validateAndImportJson(
  db: Database,
  content: string,
  dryRun: boolean,
): Promise<ImportReport> {
  const errors: ImportError[] = [];

  // 1. Parse JSON
  let data: Partial<BackupJsonFormat>;
  try {
    data = JSON.parse(content);
  } catch {
    return {
      success: false,
      dry_run: dryRun,
      counts: { decks: 0, notes: 0, cards: 0, review_events: 0 },
      errors: [{ code: 'INVALID_JSON', message: 'Invalid JSON file syntax' }],
    };
  }

  // 2. Format version
  if (!data || typeof data !== 'object' || data.format !== 1) {
    errors.push({
      code: 'UNSUPPORTED_FORMAT',
      message: 'Unsupported format version',
      path: 'format',
    });
  }

  // 3. Validate decks
  const decksData: BackupDeck[] = Array.isArray(data?.decks) ? data.decks : [];
  const deckSourceIds = new Set<string>();

  for (let i = 0; i < decksData.length; i++) {
    const d = decksData[i];
    if (d && typeof d.source_id === 'string' && d.source_id.trim() !== '') {
      deckSourceIds.add(d.source_id);
    } else {
      errors.push({
        code: 'INVALID_DECK',
        message: 'Deck is missing valid source_id',
        path: `decks[${i}]`,
      });
    }
    if (!d || typeof d.title !== 'string' || d.title.trim() === '') {
      errors.push({
        code: 'INVALID_DECK_TITLE',
        message: 'Deck is missing valid title',
        path: `decks[${i}].title`,
      });
    }
  }

  // 4. Validate notes and their cards
  const notesData: BackupNote[] = Array.isArray(data?.notes) ? data.notes : [];
  const cardSourceIds = new Set<string>();
  let totalCardsCount = 0;

  for (let i = 0; i < notesData.length; i++) {
    const note = notesData[i];
    const path = `notes[${i}]`;

    if (!note || typeof note !== 'object') {
      errors.push({
        code: 'INVALID_NOTE',
        message: 'Note must be an object',
        path,
      });
      continue;
    }

    // Note type check
    const noteType = String(note.note_type ?? '');
    if (noteType.startsWith('x-')) {
      errors.push({
        code: 'CUSTOM_NOTE_TYPE',
        message: 'custom note types require a newer format',
        path: `${path}.note_type`,
      });
    } else if (noteType !== BASIC_NOTE_TYPE) {
      errors.push({
        code: 'UNSUPPORTED_NOTE_TYPE',
        message: 'unsupported note type',
        path: `${path}.note_type`,
      });
    }

    // Fields version check
    if (note.fields_version !== BASIC_NOTE_FIELDS_VERSION) {
      errors.push({
        code: 'UNSUPPORTED_FIELDS_VERSION',
        message: 'unsupported fields version',
        path: `${path}.fields_version`,
      });
    }

    // Deck reference check
    const noteDeckRefs: string[] = Array.isArray(note.decks) ? note.decks : [];
    for (const deckRef of noteDeckRefs) {
      if (!deckSourceIds.has(deckRef)) {
        errors.push({
          code: 'UNKNOWN_DECK_REFERENCE',
          message: `note references unknown deck source_id: ${deckRef}`,
          path: `${path}.decks`,
        });
      }
    }

    // Cards validation
    const cardsData: BackupCard[] = Array.isArray(note.cards) ? note.cards : [];
    totalCardsCount += cardsData.length;

    for (let j = 0; j < cardsData.length; j++) {
      const card = cardsData[j];
      const cardPath = `${path}.cards[${j}]`;

      if (!card || typeof card.source_id !== 'string') {
        errors.push({
          code: 'INVALID_CARD',
          message: 'Card missing source_id',
          path: cardPath,
        });
        continue;
      }
      cardSourceIds.add(card.source_id);

      if (typeof card.active !== 'boolean') {
        errors.push({
          code: 'INVALID_CARD_ACTIVE',
          message: 'Card active must be boolean',
          path: cardPath,
        });
      }
      if (typeof card.due_at !== 'number') {
        errors.push({
          code: 'INVALID_CARD_DUE',
          message: 'Card due_at must be a timestamp number',
          path: cardPath,
        });
      }
      if (
        typeof card.scheduled_interval_minutes !== 'number' ||
        card.scheduled_interval_minutes < 0
      ) {
        errors.push({
          code: 'INVALID_CARD_INTERVAL',
          message:
            'Card scheduled_interval_minutes must be a non-negative number',
          path: cardPath,
        });
      }
    }
  }

  // 5. Validate review events
  const reviewEventsData: BackupReviewEvent[] = Array.isArray(
    data?.review_events,
  )
    ? data.review_events
    : [];

  for (let k = 0; k < reviewEventsData.length; k++) {
    const re = reviewEventsData[k];
    const rePath = `review_events[${k}]`;

    if (!re || typeof re !== 'object') {
      errors.push({
        code: 'INVALID_REVIEW_EVENT',
        message: 'Review event must be an object',
        path: rePath,
      });
      continue;
    }
    if (!re.source_card_id || !cardSourceIds.has(re.source_card_id)) {
      errors.push({
        code: 'UNKNOWN_CARD_REFERENCE',
        message: `review event references unknown source_card_id: ${re.source_card_id ?? 'missing'}`,
        path: rePath,
      });
    }
    if (typeof re.rating !== 'number' || re.rating < 1 || re.rating > 4) {
      errors.push({
        code: 'INVALID_RATING',
        message: 'invalid schedule or rating value',
        path: rePath,
      });
    }
    if (typeof re.reviewed_at !== 'number') {
      errors.push({
        code: 'INVALID_REVIEWED_AT',
        message: 'invalid reviewed_at timestamp',
        path: rePath,
      });
    }
  }

  // 6. Build counts and check if we should stop
  const counts: ImportCounts = {
    decks: decksData.length,
    notes: notesData.length,
    cards: totalCardsCount,
    review_events: reviewEventsData.length,
  };

  if (dryRun || errors.length > 0) {
    return { success: errors.length === 0, dry_run: dryRun, counts, errors };
  }

  // 7. Atomic batch write — fresh IDs for everything
  const now = Date.now();
  const deckIdMap = new Map<string, string>();
  const cardIdMap = new Map<string, string>();
  const batchOps: BatchOperation[] = [];
  // Create decks
  for (const d of decksData) {
    const newDeckId = randomId();
    if (d.source_id) deckIdMap.set(d.source_id, newDeckId);
    batchOps.push(
      db.get(UserDeck).prepareCreate({
        id: newDeckId,
        title: d.title ?? 'Untitled Deck',
        description: d.description ?? null,
        created_at: now,
        updated_at: now,
      }),
    );
  }
  // Create notes, deck memberships, and cards
  for (const note of notesData) {
    const newNoteId = randomId();
    batchOps.push(
      db.get(UserNote).prepareCreate({
        id: newNoteId,
        note_type: note.note_type ?? BASIC_NOTE_TYPE,
        fields_version: note.fields_version ?? BASIC_NOTE_FIELDS_VERSION,
        fields_json: JSON.stringify(note.fields ?? {}),
        additional_content: note.additional_content ?? null,
        created_at: now,
        updated_at: now,
      }),
    );
    // Deck memberships
    const noteDeckRefs: string[] = Array.isArray(note.decks) ? note.decks : [];
    for (const deckSourceId of noteDeckRefs) {
      const newDeckId = deckIdMap.get(deckSourceId);
      if (newDeckId) {
        batchOps.push(
          db.get(UserNoteDeck).prepareCreate({
            id: noteDeckId(newNoteId, newDeckId),
            note_id: newNoteId,
            deck_id: newDeckId,
            active: true,
            created_at: now,
            updated_at: now,
          }),
        );
      }
    }
    // Cards
    const cardsData: BackupCard[] = Array.isArray(note.cards) ? note.cards : [];
    for (const card of cardsData) {
      const templateKey = card.template_key ?? 'front-back';
      const newCardId = cardId(newNoteId, templateKey);
      if (card.source_id) cardIdMap.set(card.source_id, newCardId);
      const fields = note.fields ?? {};
      batchOps.push(
        db.get(UserCard).prepareCreate({
          id: newCardId,
          note_id: newNoteId,
          template_key: templateKey,
          active: card.active ?? true,
          front: fields.front ?? '',
          back: fields.back ?? '',
          due_at: card.due_at ?? now,
          scheduled_interval_minutes: card.scheduled_interval_minutes ?? 0,
          created_at: now,
          updated_at: now,
        }),
      );
    }
  }
  // Create review events
  for (const re of reviewEventsData) {
    const newCardId = re.source_card_id
      ? cardIdMap.get(re.source_card_id)
      : undefined;
    if (newCardId) {
      batchOps.push(
        db.get(ReviewEvent).prepareCreate({
          id: randomId(),
          user_card_id: newCardId,
          rating: re.rating ?? 1,
          reviewed_at: re.reviewed_at ?? now,
        }),
      );
    }
  }
  // Single atomic transaction
  await db.write(async () => {
    await db.batch(batchOps);
  });
  return {
    success: true,
    dry_run: false,
    counts,
    errors: [],
  };
}
