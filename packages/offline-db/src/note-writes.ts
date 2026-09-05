/**
 * The write paths for registered note types (#194): compile once through
 * the registry (parse + render), write the note, and prepare its cards —
 * one batch, so a note and its sibling cards change atomically or not at
 * all. New notes prepare their cards directly, no queries; updates
 * reconcile against what exists.
 */
import { randomId, type BatchOperation, type Database } from '@remelondb/core';
// TODO(remelondb 0.3): mint through db.randomId() so a configured
// randomSource covers these ids too. Ordering per the 0.3 adoption plan:
// the NAC bump PR passes randomSource at Database.open, swaps these two
// call sites, and deletes the mobile crypto shim, in that one change.
import { noteDeckId } from './ids.js';
import { BASIC_NOTE_TYPE } from './note-constants.js';
import {
  prepareCardsForNewNote,
  prepareReconcileNoteCards,
} from './note-reconcile.js';
import { compileNote } from './note-registry.js';
import { UserDeck, UserNote, UserNoteDeck } from './user-dictionary.js';

export interface NoteInput {
  readonly noteType: string;
  readonly fieldsVersion: number;
  readonly fields: unknown;
}

function assertNoteTypesMatchDeck(
  deckType: string,
  notes: readonly NoteInput[],
): void {
  const mismatched = notes.find((note) => note.noteType !== deckType);
  if (mismatched) {
    throw new Error(
      `A '${deckType}' deck cannot contain a '${mismatched.noteType}' note`,
    );
  }
}

function prepareNewNote(
  db: Database,
  deckId: string,
  input: NoteInput,
  now: number,
): { noteId: string; operations: BatchOperation[] } {
  const compiled = compileNote(
    input.noteType,
    input.fieldsVersion,
    input.fields,
  );
  const noteId = randomId();
  const note = db.get(UserNote).prepareCreate({
    id: noteId,
    note_type: input.noteType,
    fields_version: input.fieldsVersion,
    fields_json: compiled.fieldsJson,
    additional_content: null,
    created_at: now,
    updated_at: now,
  });
  const membership = db.get(UserNoteDeck).prepareCreate({
    id: noteDeckId(noteId, deckId),
    note_id: noteId,
    deck_id: deckId,
    active: true,
    created_at: now,
    updated_at: now,
  });
  return {
    noteId,
    operations: [
      note,
      membership,
      ...prepareCardsForNewNote(db, noteId, compiled, now),
    ],
  };
}

/** Create one note in a deck; its sibling cards appear in the same batch. */
export async function createNote(
  db: Database,
  deckId: string,
  input: NoteInput,
) {
  return await db.write(async () => {
    const deck = await db.get(UserDeck).find(deckId);
    assertNoteTypesMatchDeck(deck.note_type, [input]);
    const { noteId, operations } = prepareNewNote(
      db,
      deckId,
      input,
      Date.now(),
    );
    await db.batch(operations);
    return await db.get(UserNote).find(noteId);
  });
}

/** Update a note's fields; its cards follow in the same batch. */
export async function updateNoteFields(
  db: Database,
  noteId: string,
  fields: unknown,
) {
  return await db.write(async () => {
    const now = Date.now();
    const note = await db.get(UserNote).find(noteId);
    const compiled = compileNote(note.note_type, note.fields_version, fields);
    const cards = await prepareReconcileNoteCards(db, note.id, compiled);
    await db.batch([
      note.prepareUpdate((record) => {
        record.fields_json = compiled.fieldsJson;
        record.updated_at = now;
      }),
      ...cards,
    ]);
    return note;
  });
}

export interface CreateNotesBatchOptions {
  readonly deckIdOrTitle: string;
  readonly isNew: boolean;
  readonly description?: string | null;
  readonly notes: readonly NoteInput[];
}

/**
 * Create many notes at once, into an existing deck or a new one — the
 * save path for AI generation. Every note compiles before anything is
 * prepared, so one invalid item aborts the whole batch. Existing decks are
 * read once to enforce their note type; a new batch deck is always basic.
 */
export async function createNotesBatch(
  db: Database,
  options: CreateNotesBatchOptions,
) {
  return await db.write(async () => {
    const now = Date.now();
    const operations: BatchOperation[] = [];
    let targetDeckId: string;
    let deckType: string;

    if (options.isNew) {
      targetDeckId = randomId();
      deckType = BASIC_NOTE_TYPE;
      operations.push(
        db.get(UserDeck).prepareCreate({
          id: targetDeckId,
          title: options.deckIdOrTitle,
          description: options.description || null,
          // This path saves AI-generated basic cards, so the deck it makes
          // holds basic notes and carries no languages.
          note_type: BASIC_NOTE_TYPE,
          native_language_id: null,
          target_language_id: null,
          created_at: now,
          updated_at: now,
        }),
      );
    } else {
      targetDeckId = options.deckIdOrTitle;
      deckType = (await db.get(UserDeck).find(targetDeckId)).note_type;
    }
    assertNoteTypesMatchDeck(deckType, options.notes);

    for (const input of options.notes) {
      operations.push(
        ...prepareNewNote(db, targetDeckId, input, now).operations,
      );
    }

    await db.batch(operations);
    return targetDeckId;
  });
}
