/**
 * Card reconciliation (#194): keep a note's sibling cards in step with a
 * compiled note. By the deterministic cardId(noteId, templateKey):
 *
 * - compiled and missing  → create, due now
 * - compiled and existing → update front/back in place; a card restored from
 *   empty content becomes due now, without changing its activation
 * - uncompiled → clear its rendered sides; never delete or deactivate
 * - a card whose template key the registry does not know (written by a
 *   newer client) is left strictly alone
 *
 * Operations are prepared, not committed, so a caller bundles them with
 * the note write itself into one db.batch: note and cards change
 * atomically or not at all.
 */
import {
  Q,
  type BatchOperation,
  type Database,
  type SyncController,
} from '@remelondb/core';
import { cardId } from './ids.js';
import { compileNote, noteTypeRegistry, type CompiledNote } from '@repo/study';
import { UserCard, UserNote } from './user-dictionary.js';

/** Cards for a brand-new note: no queries, nothing can exist yet. */
export function prepareCardsForNewNote(
  db: Database,
  noteId: string,
  compiled: CompiledNote,
  now: number,
): BatchOperation[] {
  return compiled.cards.map((card) =>
    db.get(UserCard).prepareCreate({
      id: cardId(noteId, card.templateKey),
      note_id: noteId,
      template_key: card.templateKey,
      active: false,
      front: card.front,
      back: card.back,
      due_at: now,
      scheduled_interval_minutes: 0,
      created_at: now,
      updated_at: now,
    }),
  );
}

/** Reconcile an existing note's cards against its compiled result. */
export async function prepareReconcileNoteCards(
  db: Database,
  noteId: string,
  compiled: CompiledNote,
): Promise<BatchOperation[]> {
  // All of the note's cards, the deactivated ones included: the reactivate
  // path needs them, and the active-only dashboard queries must not decide
  // what exists here.
  const existing = await db
    .get(UserCard)
    .query(Q.where('note_id', noteId))
    .fetch();
  const byId = new Map(existing.map((card) => [card.id, card]));
  const rendered = new Map(
    compiled.cards.map((card) => [cardId(noteId, card.templateKey), card]),
  );

  const now = Date.now();
  const operations: BatchOperation[] = [];

  for (const templateKey of compiled.templateKeys) {
    const id = cardId(noteId, templateKey);
    const card = byId.get(id);
    const wanted = rendered.get(id);

    if (wanted) {
      if (!card) {
        operations.push(
          db.get(UserCard).prepareCreate({
            id,
            note_id: noteId,
            template_key: templateKey,
            active: existing.some((sibling) => sibling.active),
            front: wanted.front,
            back: wanted.back,
            due_at: now,
            scheduled_interval_minutes: 0,
            created_at: now,
            updated_at: now,
          }),
        );
      } else {
        const wasIncomplete = card.front === '' || card.back === '';
        if (
          card.front !== wanted.front ||
          card.back !== wanted.back ||
          wasIncomplete
        ) {
          operations.push(
            card.prepareUpdate((record) => {
              record.front = wanted.front;
              record.back = wanted.back;
              if (wasIncomplete) {
                // Restored content is immediately available if its word is active.
                record.due_at = now;
              }
              record.updated_at = now;
            }),
          );
        }
      }
    } else if (card && (card.front !== '' || card.back !== '')) {
      operations.push(
        card.prepareUpdate((record) => {
          record.front = '';
          record.back = '';
          record.updated_at = now;
        }),
      );
    }
  }

  return operations;
}

/**
 * Clears content left by the pre-#408 reconcile behavior.
 *
 * Old clients deactivated an unrenderable card but retained its previous
 * sides. New clients represent an unrenderable sibling with blank sides.
 * This pass only changes old rows that still have content, so already-correct
 * blank cards stay untouched.
 */
export async function normalizeLegacyCardContent(
  db: Database,
): Promise<number> {
  return await db.write(async () => {
    const [notes, cards] = await Promise.all([
      db.get(UserNote).query().fetch(),
      db.get(UserCard).query().fetch(),
    ]);
    const cardsByNote = new Map<string, typeof cards>();
    for (const card of cards) {
      const siblings = cardsByNote.get(card.note_id) ?? [];
      siblings.push(card);
      cardsByNote.set(card.note_id, siblings);
    }

    const operations: BatchOperation[] = [];
    const now = Date.now();
    for (const note of notes) {
      const entry = noteTypeRegistry[note.note_type]?.[note.fields_version];
      if (!entry) continue;

      let compiled: CompiledNote;
      try {
        compiled = compileNote(
          note.note_type,
          note.fields_version,
          JSON.parse(note.fields_json),
        );
      } catch {
        // A client that cannot understand a future or malformed note must not
        // erase card content it cannot safely reconstruct.
        continue;
      }
      const renderedKeys = new Set(
        compiled.cards.map((card) => card.templateKey),
      );
      const siblings = cardsByNote.get(note.id) ?? [];

      for (const card of siblings) {
        const templateIsKnown = entry.templates.some(
          (template) => template.key === card.template_key,
        );
        if (
          !templateIsKnown ||
          renderedKeys.has(card.template_key) ||
          (card.front === '' && card.back === '')
        ) {
          continue;
        }

        const wordIsActive = siblings.some(
          (sibling) => sibling.id !== card.id && sibling.active,
        );
        operations.push(
          card.prepareUpdate((record) => {
            record.active = wordIsActive;
            record.front = '';
            record.back = '';
            record.updated_at = now;
          }),
        );
      }
    }

    if (operations.length > 0) await db.batch(operations);
    return operations.length;
  });
}

export const LEGACY_CARD_CONTENT_CLEANUP_VERSION = 1;

export function legacyCardContentCleanupStorageKey(userId: string) {
  return `not-another-cards:legacy-card-content-cleanup:${userId}`;
}

export type LegacyCardContentCleanupState = {
  isComplete: () => boolean;
  markComplete: () => void;
};

/** Run the legacy cleanup once after the first completed synchronization. */
export function normalizeLegacyCardContentAfterSync(
  db: Database,
  syncController: Pick<SyncController, 'notifyLocalWrite' | 'subscribe'>,
  cleanupState: LegacyCardContentCleanupState,
): () => void {
  let live = true;
  let normalizing = false;
  const normalize = async () => {
    if (normalizing || cleanupState.isComplete()) return;
    normalizing = true;
    try {
      const normalized = await normalizeLegacyCardContent(db);
      cleanupState.markComplete();
      if (live && normalized > 0) syncController.notifyLocalWrite();
    } catch {
      // A later sync or app start retries. Failure here must not prevent the
      // already-open local database from being used.
    } finally {
      normalizing = false;
    }
  };
  const unsubscribe = syncController.subscribe((state) => {
    if (state.status === 'idle' && state.lastSyncAt !== null) {
      void normalize();
    }
  });
  return () => {
    live = false;
    unsubscribe();
  };
}
