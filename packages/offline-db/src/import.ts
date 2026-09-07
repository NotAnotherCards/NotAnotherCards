import { Database, randomId, type BatchOperation, Q } from '@remelondb/core';
import { cardId, noteDeckId, systemDeckId } from './ids.js';
import {
  BASIC_NOTE_TYPE,
  BASIC_NOTE_FIELDS_VERSION,
  WORD_NOTE_TYPE,
} from './note-constants.js';
import { LANGUAGES } from '@repo/schemas';
import { REVIEW_INTERVAL_CAP_MINUTES } from './review-scheduler.js';
import {
  UserDeck,
  UserNote,
  UserCard,
  UserNoteDeck,
  ReviewEvent,
  PRIVATE_DECK,
} from './user-dictionary.js';
import type {
  BackupJsonFormat,
  BackupDeck,
  BackupNote,
  BackupCard,
  BackupReviewEvent,
} from './export-import-types.js';
import {
  noteFieldsSchemas,
  validateNoteFieldsJson,
  compileNote,
} from './note-registry.js';

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
    return {
      success: false,
      dry_run: dryRun,
      counts: { decks: 0, notes: 0, cards: 0, review_events: 0 },
      errors,
    };
  }

  // 3. Validate decks
  const decksData: BackupDeck[] = Array.isArray(data?.decks) ? data.decks : [];
  const deckSourceIds = new Set<string>();
  const deckTypes = new Map<string, string>();
  const validLanguageIds = new Set<string>(LANGUAGES.map((l) => l.value));

  for (let i = 0; i < decksData.length; i++) {
    const d = decksData[i];
    if (d && typeof d.source_id === 'string' && d.source_id.trim() !== '') {
      if (deckSourceIds.has(d.source_id)) {
        errors.push({
          code: 'DUPLICATE_DECK_SOURCE_ID',
          message: `duplicate deck source_id: ${d.source_id}`,
          path: `decks[${i}]`,
        });
      }
      deckSourceIds.add(d.source_id);
      deckTypes.set(d.source_id, d.note_type ?? BASIC_NOTE_TYPE);
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

    if (d) {
      const deckType = d.note_type ?? BASIC_NOTE_TYPE;
      if (deckType === WORD_NOTE_TYPE) {
        if (!d.native_language || !d.target_language) {
          errors.push({
            code: 'INVALID_DECK_LANGUAGES',
            message: 'Word deck must have native and target languages',
            path: `decks[${i}]`,
          });
        } else if (d.native_language === d.target_language) {
          errors.push({
            code: 'INVALID_DECK_LANGUAGES',
            message: 'Word deck native and target languages must be distinct',
            path: `decks[${i}]`,
          });
        } else if (
          !validLanguageIds.has(d.native_language) ||
          !validLanguageIds.has(d.target_language)
        ) {
          errors.push({
            code: 'INVALID_DECK_LANGUAGES',
            message: 'Word deck languages must be valid language IDs',
            path: `decks[${i}]`,
          });
        }
      } else if (deckType === BASIC_NOTE_TYPE) {
        if (d.native_language || d.target_language) {
          errors.push({
            code: 'INVALID_DECK_LANGUAGES',
            message: 'Basic deck must not have language ids',
            path: `decks[${i}]`,
          });
        }
      }
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

    // Note type and fields validation
    const noteType = String(note.note_type ?? BASIC_NOTE_TYPE);
    const version = note.fields_version ?? BASIC_NOTE_FIELDS_VERSION;
    if (!noteFieldsSchemas[noteType]?.[version]) {
      errors.push({
        code: 'UNSUPPORTED_NOTE_TYPE',
        message: `unsupported note type or version: ${noteType}@${version}`,
        path: `${path}.note_type`,
      });
    } else {
      const fieldsJson = JSON.stringify(note.fields ?? {});
      const validationResult = validateNoteFieldsJson(
        noteType,
        version,
        fieldsJson,
      );
      if (!validationResult.success) {
        errors.push({
          code: 'INVALID_FIELDS',
          message: validationResult.error,
          path: `${path}.fields`,
        });
      }
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
      } else {
        const deckType = deckTypes.get(deckRef);
        if (deckType && deckType !== noteType) {
          errors.push({
            code: 'NOTE_DECK_TYPE_MISMATCH',
            message: `note type (${noteType}) does not match deck type (${deckType})`,
            path: `${path}.decks`,
          });
        }
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
      if (cardSourceIds.has(card.source_id)) {
        errors.push({
          code: 'DUPLICATE_CARD_SOURCE_ID',
          message: `duplicate card source_id: ${card.source_id}`,
          path: cardPath,
        });
      }
      cardSourceIds.add(card.source_id);

      if (typeof card.active !== 'boolean') {
        errors.push({
          code: 'INVALID_CARD_ACTIVE',
          message: 'Card active must be boolean',
          path: cardPath,
        });
      }
      if (typeof card.due_at !== 'number' || !Number.isInteger(card.due_at)) {
        errors.push({
          code: 'INVALID_CARD_DUE',
          message: 'Card due_at must be an integer timestamp',
          path: cardPath,
        });
      }
      if (
        typeof card.scheduled_interval_minutes !== 'number' ||
        !Number.isInteger(card.scheduled_interval_minutes) ||
        card.scheduled_interval_minutes < 0 ||
        card.scheduled_interval_minutes > REVIEW_INTERVAL_CAP_MINUTES
      ) {
        errors.push({
          code: 'INVALID_CARD_INTERVAL',
          message: `Card scheduled_interval_minutes must be a non-negative integer up to ${REVIEW_INTERVAL_CAP_MINUTES}`,
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
    if (
      typeof re.reviewed_at !== 'number' ||
      !Number.isInteger(re.reviewed_at)
    ) {
      errors.push({
        code: 'INVALID_REVIEWED_AT',
        message: 'reviewed_at must be an integer timestamp',
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
  const sysDecksNeeded = new Map<
    string,
    {
      type: 'cards' | 'words';
      target: string | null;
      native: string | null;
      noteType: string;
    }
  >();
  // We no longer create local UserDecks for imported thematic decks.
  // We only map their source IDs in case we need to track references.
  for (const d of decksData) {
    const newDeckId = randomId();
    if (d.source_id) deckIdMap.set(d.source_id, newDeckId);
  }
  // Create notes, deck memberships, and cards
  for (const note of notesData) {
    const newNoteId = randomId();
    const noteType = note.note_type ?? BASIC_NOTE_TYPE;
    const version = note.fields_version ?? BASIC_NOTE_FIELDS_VERSION;
    const compiled = compileNote(noteType, version, note.fields ?? {});

    // Compute sys deck
    let target: string | null = null;
    let native: string | null = null;
    if (noteType === WORD_NOTE_TYPE) {
      const f = JSON.parse(compiled.fieldsJson) as {
        target_language_id?: string;
        native_language_id?: string;
      };
      target = f.target_language_id || null;
      native = f.native_language_id || null;
    }
    const sysType = noteType === BASIC_NOTE_TYPE ? 'cards' : 'words';
    const sId = systemDeckId(sysType, target || undefined);

    if (!sysDecksNeeded.has(sId)) {
      sysDecksNeeded.set(sId, { type: sysType, target, native, noteType });
    }

    batchOps.push(
      db.get(UserNote).prepareCreate({
        id: newNoteId,
        note_type: noteType,
        fields_version: version,
        fields_json: compiled.fieldsJson,
        additional_content: note.additional_content ?? null,
        created_at: now,
        updated_at: now,
      }),
    );

    // We only attach imported notes to their automatic system collection.
    // Thematic deck memberships from the backup are deliberately discarded.
    batchOps.push(
      db.get(UserNoteDeck).prepareCreate({
        id: noteDeckId(newNoteId, sId),
        note_id: newNoteId,
        deck_id: sId,
        active: true,
        created_at: now,
        updated_at: now,
      }),
    );
    // Cards

    const cardsData: BackupCard[] = Array.isArray(note.cards) ? note.cards : [];
    const sourceCardByTemplateKey = new Map(
      cardsData.map((c) => [c.template_key ?? 'front-back', c]),
    );

    for (const compiledCard of compiled.cards) {
      const templateKey = compiledCard.templateKey;
      const sourceCard = sourceCardByTemplateKey.get(templateKey);
      const newCardId = cardId(newNoteId, templateKey);

      if (sourceCard?.source_id) {
        cardIdMap.set(sourceCard.source_id, newCardId);
      }

      batchOps.push(
        db.get(UserCard).prepareCreate({
          id: newCardId,
          note_id: newNoteId,
          template_key: templateKey,
          active: sourceCard?.active ?? true,
          front: compiledCard.front,
          back: compiledCard.back,
          due_at: sourceCard?.due_at ?? now,
          scheduled_interval_minutes:
            sourceCard?.scheduled_interval_minutes ?? 0,
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
    const sysDeckIds = Array.from(sysDecksNeeded.keys());
    if (sysDeckIds.length > 0) {
      const existingSysDecks = await db
        .get(UserDeck)
        .query(Q.where('id', Q.oneOf(sysDeckIds)))
        .fetch();
      const existingIds = new Set(existingSysDecks.map((d) => d.id));
      for (const [sId, info] of sysDecksNeeded.entries()) {
        if (!existingIds.has(sId)) {
          batchOps.push(
            db.get(UserDeck).prepareCreate({
              id: sId,
              title: info.type === 'cards' ? 'Cards' : 'All Words',
              description: null,
              note_type: info.noteType,
              native_language_id: info.native,
              target_language_id: info.target,
              visibility: PRIVATE_DECK,
              created_at: now,
              updated_at: now,
            }),
          );
        }
      }
    }
    await db.batch(batchOps);
  });
  return {
    success: true,
    dry_run: false,
    counts,
    errors: [],
  };
}

// CSV parser that handles quoted fields, commas inside quotes, and line breaks
function parseCsvRows(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field.trim());
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(field.trim());
        if (row.some((cell) => cell.length > 0)) {
          lines.push(row);
        }
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  // Flush the last row
  if (field || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }
  return lines;
}

async function validateAndImportCsv(
  db: Database,
  content: string,
  dryRun: boolean,
): Promise<ImportReport> {
  const errors: ImportError[] = [];
  const rows = parseCsvRows(content);

  if (rows.length === 0) {
    return {
      success: false,
      dry_run: dryRun,
      counts: { decks: 0, notes: 0, cards: 0, review_events: 0 },
      errors: [{ code: 'EMPTY_CSV', message: 'CSV file is empty' }],
    };
  }

  // Read header row and find column indices
  const header = rows[0].map((cell) => cell.toLowerCase());
  const frontIdx = header.indexOf('front');
  const backIdx = header.indexOf('back');
  const deckIdx = header.indexOf('deck');
  const activeIdx = header.indexOf('active');
  const dueAtIdx = header.indexOf('due_at');
  const intervalIdx = header.indexOf('scheduled_interval_minutes');

  if (frontIdx === -1 || backIdx === -1) {
    errors.push({
      code: 'MISSING_CSV_COLUMNS',
      message: 'CSV must contain at least "front" and "back" header columns',
      row: 1,
    });
  }

  // Look up existing decks so we don't create duplicates
  const existingDecks = db ? await db.get(UserDeck).query().fetch() : [];
  const deckTitleToIdMap = new Map<string, string>();
  const nonBasicDeckTitles = new Map<string, string>();
  for (const d of existingDecks) {
    const lowerTitle = d.title.toLowerCase();
    if (d.note_type === BASIC_NOTE_TYPE) {
      deckTitleToIdMap.set(lowerTitle, d.id);
    } else {
      nonBasicDeckTitles.set(lowerTitle, d.note_type);
    }
  }

  const newDeckTitles = new Set<string>();
  const parsedRows: Array<{
    front: string;
    back: string;
    deckTitle: string;
    active: boolean;
    dueAt: number;
    interval: number;
  }> = [];

  // Validate each data row
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNum = r + 1;

    const front = frontIdx !== -1 && row[frontIdx] ? row[frontIdx] : '';
    const back = backIdx !== -1 && row[backIdx] ? row[backIdx] : '';
    const deckTitle =
      deckIdx !== -1 && row[deckIdx] ? row[deckIdx] : 'Default Deck';

    if (!front) {
      errors.push({
        code: 'MISSING_FRONT',
        message: 'Row is missing front field',
        row: rowNum,
      });
    }
    if (!back) {
      errors.push({
        code: 'MISSING_BACK',
        message: 'Row is missing back field',
        row: rowNum,
      });
    }

    let active = true;
    if (activeIdx !== -1 && row[activeIdx]) {
      const val = row[activeIdx].toLowerCase();
      if (val === 'false' || val === '0') active = false;
      else if (val === 'true' || val === '1') active = true;
      else {
        errors.push({
          code: 'INVALID_ACTIVE',
          message: 'active column must be true or false',
          row: rowNum,
        });
      }
    }

    let dueAt = Date.now();
    if (dueAtIdx !== -1 && row[dueAtIdx]?.trim()) {
      const rawDueAt = row[dueAtIdx].trim();
      const parsedNum = Number(rawDueAt);
      if (!isNaN(parsedNum) && rawDueAt !== '') {
        dueAt = Math.round(parsedNum);
      } else {
        const parsedDate = Date.parse(rawDueAt);
        if (!isNaN(parsedDate)) dueAt = parsedDate;
        else {
          errors.push({
            code: 'INVALID_DUE_AT',
            message: 'due_at column must be a valid timestamp',
            row: rowNum,
          });
        }
      }
    }

    let interval = 0;
    if (intervalIdx !== -1 && row[intervalIdx]?.trim()) {
      const parsedInterval = Number(row[intervalIdx].trim());
      if (!isNaN(parsedInterval) && parsedInterval >= 0) {
        interval = Math.round(parsedInterval);
      } else {
        errors.push({
          code: 'INVALID_INTERVAL',
          message: 'scheduled_interval_minutes must be a non-negative number',
          row: rowNum,
        });
      }
    }

    if (deckTitle) {
      const lowerDeckTitle = deckTitle.toLowerCase();
      if (nonBasicDeckTitles.has(lowerDeckTitle)) {
        errors.push({
          code: 'NON_BASIC_DECK_MATCH',
          message: `CSV row targets deck "${deckTitle}", but it is a ${nonBasicDeckTitles.get(lowerDeckTitle)} deck. CSV imports can only target basic decks.`,
          row: rowNum,
        });
      } else if (!deckTitleToIdMap.has(lowerDeckTitle)) {
        newDeckTitles.add(deckTitle);
      }
    }

    parsedRows.push({ front, back, deckTitle, active, dueAt, interval });
  }

  const counts: ImportCounts = {
    decks: newDeckTitles.size,
    notes: parsedRows.length,
    cards: parsedRows.length,
    review_events: 0,
  };

  if (dryRun || errors.length > 0) {
    return { success: errors.length === 0, dry_run: dryRun, counts, errors };
  }

  // Atomic batch write
  const now = Date.now();
  const batchOps: BatchOperation[] = [];

  // We no longer create local UserDecks for CSV thematic columns.

  // Create a note + card + deck membership per CSV row
  for (const item of parsedRows) {
    const noteId = randomId();
    const templateKey = 'front-back';
    const generatedCardId = cardId(noteId, templateKey);
    const sId = systemDeckId('cards');

    batchOps.push(
      db.get(UserNote).prepareCreate({
        id: noteId,
        note_type: BASIC_NOTE_TYPE,
        fields_version: BASIC_NOTE_FIELDS_VERSION,
        fields_json: JSON.stringify({ front: item.front, back: item.back }),
        additional_content: null,
        created_at: now,
        updated_at: now,
      }),
    );

    batchOps.push(
      db.get(UserCard).prepareCreate({
        id: generatedCardId,
        note_id: noteId,
        template_key: templateKey,
        active: item.active,
        front: item.front,
        back: item.back,
        due_at: item.dueAt,
        scheduled_interval_minutes: item.interval,
        created_at: now,
        updated_at: now,
      }),
    );

    batchOps.push(
      db.get(UserNoteDeck).prepareCreate({
        id: noteDeckId(noteId, sId),
        note_id: noteId,
        deck_id: sId,
        active: true,
        created_at: now,
        updated_at: now,
      }),
    );
  }

  await db.write(async () => {
    const sId = systemDeckId('cards');
    const existingSysDecks = await db
      .get(UserDeck)
      .query(Q.where('id', sId))
      .fetch();
    if (existingSysDecks.length === 0) {
      batchOps.push(
        db.get(UserDeck).prepareCreate({
          id: sId,
          title: 'Cards',
          description: null,
          note_type: BASIC_NOTE_TYPE,
          native_language_id: null,
          target_language_id: null,
          visibility: PRIVATE_DECK,
          created_at: now,
          updated_at: now,
        }),
      );
    }
    await db.batch(batchOps);
  });

  return {
    success: true,
    dry_run: false,
    counts,
    errors: [],
  };
}
