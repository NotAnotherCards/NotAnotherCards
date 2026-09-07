/**
 * Card reconciliation (#194): keep a note's sibling cards in step with a
 * compiled note. By the deterministic cardId(noteId, templateKey):
 *
 * - compiled and missing  → create, due now
 * - compiled and existing → update front/back in place; if it was
 *   deactivated, reactivate as due now with its history intact (#157)
 * - uncompiled and active → deactivate; never delete
 * - a card whose template key the registry does not know (written by a
 *   newer client) is left strictly alone
 *
 * Operations are prepared, not committed, so a caller bundles them with
 * the note write itself into one db.batch: note and cards change
 * atomically or not at all.
 */
import { Q, type BatchOperation, type Database } from '@remelondb/core';
import { cardId } from './ids.js';
import type { CompiledNote } from './note-registry.js';
import { UserCard } from './user-dictionary.js';

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
      active: true,
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
            active: true,
            front: wanted.front,
            back: wanted.back,
            due_at: now,
            scheduled_interval_minutes: 0,
            created_at: now,
            updated_at: now,
          }),
        );
      } else {
        const reactivate = !card.active;
        if (
          card.front !== wanted.front ||
          card.back !== wanted.back ||
          reactivate
        ) {
          operations.push(
            card.prepareUpdate((record) => {
              record.front = wanted.front;
              record.back = wanted.back;
              if (reactivate) {
                // #157's reactivation rule: due now, history kept.
                record.active = true;
                record.due_at = now;
              }
              record.updated_at = now;
            }),
          );
        }
      }
    } else if (card && card.active) {
      operations.push(
        card.prepareUpdate((record) => {
          record.active = false;
          record.updated_at = now;
        }),
      );
    }
  }

  return operations;
}
