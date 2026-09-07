/**
 * The write paths for registered note types (#194): compile once through
 * the registry (parse + render), write the note, and prepare its cards —
 * one batch, so a note and its sibling cards change atomically or not at
 * all. New notes prepare their cards directly, no queries; updates
 * reconcile against what exists.
 */
import type { BatchOperation, Database } from '@remelondb/core';
import { Q } from '@remelondb/core';
import { noteDeckId, systemDeckId } from './ids.js';
import { BASIC_NOTE_TYPE, WORD_NOTE_TYPE } from './note-constants.js';
import { languageFor } from '@repo/schemas';
import {
  prepareCardsForNewNote,
  prepareReconcileNoteCards,
} from './note-reconcile.js';
import { compileNote, type CompiledNote } from './note-registry.js';
import {
  UserDeck,
  UserNote,
  UserNoteDeck,
  PRIVATE_DECK,
} from './user-dictionary.js';

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

interface CompiledNoteInfo {
  input: NoteInput;
  compiled: CompiledNote;
  sysDeckId: string;
}

async function prepareSystemDecksAndMemberships(
  db: Database,
  notes: readonly NoteInput[],
  now: number,
): Promise<{
  compiledInfos: CompiledNoteInfo[];
  operations: BatchOperation[];
}> {
  const operations: BatchOperation[] = [];
  const sysDecksNeeded = new Map<
    string,
    {
      type: 'cards' | 'words';
      target: string | null;
      native: string | null;
      noteType: string;
    }
  >();

  const compiledInfos: CompiledNoteInfo[] = notes.map((input) => {
    const compiled = compileNote(
      input.noteType,
      input.fieldsVersion,
      input.fields,
    );
    let target: string | null = null;
    let native: string | null = null;
    if (input.noteType === WORD_NOTE_TYPE) {
      const f = JSON.parse(compiled.fieldsJson) as {
        target_language_id?: string;
        native_language_id?: string;
      };
      target = f.target_language_id || null;
      native = f.native_language_id || null;
    }
    const sysType = input.noteType === BASIC_NOTE_TYPE ? 'cards' : 'words';
    const sId = systemDeckId(sysType, target || undefined);

    if (!sysDecksNeeded.has(sId)) {
      sysDecksNeeded.set(sId, {
        type: sysType,
        target,
        native,
        noteType: input.noteType,
      });
    }

    return { input, compiled, sysDeckId: sId };
  });

  const sysDeckIds = Array.from(sysDecksNeeded.keys());
  if (sysDeckIds.length > 0) {
    const existingSysDecks = await db
      .get(UserDeck)
      .query(Q.where('id', Q.oneOf(sysDeckIds)))
      .fetch();
    const existingIds = new Set(existingSysDecks.map((d) => d.id));

    for (const [sId, info] of sysDecksNeeded.entries()) {
      if (!existingIds.has(sId)) {
        operations.push(
          db.get(UserDeck).prepareCreate({
            id: sId,
            title:
              info.type === 'cards'
                ? 'Cards'
                : `All ${languageFor(info.target)?.name || ''} Words`.replace(
                    '  ',
                    ' ',
                  ),
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

  return { compiledInfos, operations };
}

function prepareNewNote(
  db: Database,
  deckId: string,
  input: NoteInput,
  now: number,
  compiledNote?: CompiledNote,
): { noteId: string; operations: BatchOperation[] } {
  const compiled =
    compiledNote ||
    compileNote(input.noteType, input.fieldsVersion, input.fields);
  const noteId = db.randomId();
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
    const now = Date.now();

    const { compiledInfos, operations: sysOps } =
      await prepareSystemDecksAndMemberships(db, [input], now);
    const info = compiledInfos[0];

    const { noteId, operations } = prepareNewNote(
      db,
      deckId,
      input,
      now,
      info.compiled,
    );

    if (deckId !== info.sysDeckId) {
      operations.push(
        db.get(UserNoteDeck).prepareCreate({
          id: noteDeckId(noteId, info.sysDeckId),
          note_id: noteId,
          deck_id: info.sysDeckId,
          active: true,
          created_at: now,
          updated_at: now,
        }),
      );
    }

    await db.batch([...sysOps, ...operations]);
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
      targetDeckId = db.randomId();
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
          visibility: PRIVATE_DECK,
          created_at: now,
          updated_at: now,
        }),
      );
    } else {
      targetDeckId = options.deckIdOrTitle;
      deckType = (await db.get(UserDeck).find(targetDeckId)).note_type;
    }
    assertNoteTypesMatchDeck(deckType, options.notes);

    const { compiledInfos, operations: sysOps } =
      await prepareSystemDecksAndMemberships(db, options.notes, now);
    operations.push(...sysOps);

    for (const info of compiledInfos) {
      const { noteId, operations: noteOps } = prepareNewNote(
        db,
        targetDeckId,
        info.input,
        now,
        info.compiled,
      );
      operations.push(...noteOps);

      if (targetDeckId !== info.sysDeckId) {
        operations.push(
          db.get(UserNoteDeck).prepareCreate({
            id: noteDeckId(noteId, info.sysDeckId),
            note_id: noteId,
            deck_id: info.sysDeckId,
            active: true,
            created_at: now,
            updated_at: now,
          }),
        );
      }
    }

    await db.batch(operations);
    return targetDeckId;
  });
}
