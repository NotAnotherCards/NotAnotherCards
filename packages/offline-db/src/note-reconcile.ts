/**
 * Card reconciliation (#194): keep a note's sibling cards in step with its
 * fields. For each template of the note's registered type, by the
 * deterministic cardId(noteId, templateKey):
 *
 * - possible and missing  → create, due now
 * - possible and existing → update front/back in place; if it was
 *   deactivated, reactivate as due now with its history intact (#157)
 * - impossible and active → deactivate; never delete
 * - a card whose template key the registry does not know (written by a
 *   newer client) is left strictly alone
 *
 * Operations are prepared, not committed, so a caller bundles them with
 * the note write itself into one db.batch: note and cards change
 * atomically or not at all.
 */
import { Q, type BatchOperation, type Database } from '@remelondb/core';
import { cardId } from './ids.js';
import { noteTypeRegistry } from './note-registry.js';
import { UserCard } from './user-dictionary.js';

export interface ReconcilableNote {
  readonly id: string;
  readonly note_type: string;
  readonly fields_version: number;
}

export async function prepareReconcileNoteCards(
  db: Database,
  note: ReconcilableNote,
  fields: unknown,
): Promise<BatchOperation[]> {
  const entry = noteTypeRegistry[note.note_type]?.[note.fields_version];
  if (!entry) {
    throw new Error(
      `Cannot reconcile cards for unregistered note type ${note.note_type}@${note.fields_version}`,
    );
  }

  // All of the note's cards, the deactivated ones included: the reactivate
  // path needs them, and the active-only dashboard queries must not decide
  // what exists here.
  const existing = await db
    .get(UserCard)
    .query(Q.where('note_id', note.id))
    .fetch();
  const byId = new Map(existing.map((card) => [card.id, card]));

  const now = Date.now();
  const operations: BatchOperation[] = [];

  for (const template of entry.templates) {
    const id = cardId(note.id, template.key);
    const card = byId.get(id);
    const possible = template.requires(fields);

    if (possible) {
      const { front, back } = template.render(fields);
      if (!card) {
        operations.push(
          db.get(UserCard).prepareCreate({
            id,
            note_id: note.id,
            template_key: template.key,
            active: true,
            front,
            back,
            due_at: now,
            scheduled_interval_minutes: 0,
            created_at: now,
            updated_at: now,
          }),
        );
      } else {
        const reactivate = !card.active;
        if (card.front !== front || card.back !== back || reactivate) {
          operations.push(
            card.prepareUpdate((record) => {
              record.front = front;
              record.back = back;
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
