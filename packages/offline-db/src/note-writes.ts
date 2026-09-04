/**
 * The write paths for registered note types (#194): validate through the
 * registry, write the note, reconcile its cards — one batch, so a note
 * and its sibling cards change atomically or not at all.
 */
import { randomId, type BatchOperation, type Database } from '@remelondb/core';
import { noteDeckId } from './ids.js';
import { prepareReconcileNoteCards } from './note-reconcile.js';
import { noteTypeRegistry } from './note-registry.js';
import { UserDeck, UserNote, UserNoteDeck } from './user-dictionary.js';

export interface NoteInput {
  readonly noteType: string;
  readonly fieldsVersion: number;
  readonly fields: unknown;
}

function parseFields(input: NoteInput): unknown {
  const entry = noteTypeRegistry[input.noteType]?.[input.fieldsVersion];
  if (!entry) {
    throw new Error(
      `Unsupported note type ${input.noteType}@${input.fieldsVersion}`,
    );
  }
  return entry.schema.parse(input.fields);
}

async function prepareNewNote(
  db: Database,
  deckId: string,
  input: NoteInput,
  now: number,
): Promise<{ noteId: string; operations: BatchOperation[] }> {
  const parsed = parseFields(input);
  const noteId = randomId();
  const note = db.get(UserNote).prepareCreate({
    id: noteId,
    note_type: input.noteType,
    fields_version: input.fieldsVersion,
    fields_json: JSON.stringify(parsed),
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
  const cards = await prepareReconcileNoteCards(
    db,
    {
      id: noteId,
      note_type: input.noteType,
      fields_version: input.fieldsVersion,
    },
    parsed,
  );
  return { noteId, operations: [note, membership, ...cards] };
}

/** Create one note in a deck; its sibling cards appear in the same batch. */
export async function createNote(
  db: Database,
  deckId: string,
  input: NoteInput,
) {
  return await db.write(async () => {
    const { noteId, operations } = await prepareNewNote(
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
    const parsed = parseFields({
      noteType: note.note_type,
      fieldsVersion: note.fields_version,
      fields,
    });
    const cards = await prepareReconcileNoteCards(
      db,
      {
        id: note.id,
        note_type: note.note_type,
        fields_version: note.fields_version,
      },
      parsed,
    );
    await db.batch([
      note.prepareUpdate((record) => {
        record.fields_json = JSON.stringify(parsed);
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
 * save path for AI generation. One batch for everything.
 */
export async function createNotesBatch(
  db: Database,
  options: CreateNotesBatchOptions,
) {
  return await db.write(async () => {
    const now = Date.now();
    const operations: BatchOperation[] = [];
    let targetDeckId: string;

    if (options.isNew) {
      targetDeckId = randomId();
      operations.push(
        db.get(UserDeck).prepareCreate({
          id: targetDeckId,
          title: options.deckIdOrTitle,
          description: options.description || null,
          created_at: now,
          updated_at: now,
        }),
      );
    } else {
      targetDeckId = options.deckIdOrTitle;
    }

    for (const input of options.notes) {
      const prepared = await prepareNewNote(db, targetDeckId, input, now);
      operations.push(...prepared.operations);
    }

    await db.batch(operations);
    return targetDeckId;
  });
}
