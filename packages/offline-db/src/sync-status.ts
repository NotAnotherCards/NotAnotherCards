import type { Database, SyncControllerState } from '@remelondb/core';

// Human names for the synced tables, for sync status copy on web and mobile.
const TABLE_LABELS: Record<string, string> = {
  user_decks: 'deck',
  user_notes: 'note',
  user_cards: 'card',
  user_note_decks: 'deck membership',
  review_events: 'review',
  user_profiles: 'profile',
  user_badges: 'badge',
};

export const REJECTION_EXPLANATION =
  'The server refused these changes. They stay on this device and are sent again with the next sync.';

/**
 * Rows the server refused on the last completed run. Only meaningful while
 * idle: after a failed run the count would describe an older push. Every
 * sync indicator reads this, so they agree on count and wording.
 */
export function rejectedSummary(state: SyncControllerState): {
  count: number;
  details: string | undefined;
} {
  const count = state.status === 'idle' ? (state.lastResult?.rejected ?? 0) : 0;
  const details = count
    ? Object.entries(state.lastResult?.rejectedRecords ?? {})
        .filter(([, ids]) => ids.length > 0)
        .map(([table, ids]) => {
          const label = TABLE_LABELS[table] ?? 'change';
          return `${ids.length} ${label}${ids.length === 1 ? '' : 's'}`;
        })
        .concat(REJECTION_EXPLANATION)
        .join('. ')
    : undefined;
  return { count, details };
}

/**
 * Whether any of the rows the server refused belong to this deck: the deck
 * itself, one of its memberships, a note with a membership in it, or a card
 * of such a note. Publishing acts on the deck's content, so a refused row of
 * another deck must not block it, and a refused row of this one must, or the
 * server would publish what the user changed or removed locally.
 */
export async function rejectionsConcernDeck(
  db: Database,
  deckId: string,
  rejectedRecords: Readonly<Record<string, readonly string[]>>,
): Promise<boolean> {
  const rejected = (table: string) => rejectedRecords[table] ?? [];
  if (rejected('user_decks').includes(deckId)) return true;
  const memberships = rejected('user_note_decks');
  const notes = rejected('user_notes');
  const cards = rejected('user_cards');
  if (!memberships.length && !notes.length && !cards.length) return false;

  // Memberships that tie a note to this deck: active ones, and inactive or
  // deleted ones the server has not accepted yet (a refused removal is what
  // must block). A removal the server took is history: the note is no
  // longer the deck's concern.
  // ponytail: raw SQL because a Query hides rows marked deleted. Use Query
  // once remelonDB exposes filterDeleted.
  const rows = await db.read(() =>
    db.driver.query(
      `select id, note_id from user_note_decks
       where deck_id = ? and not (active = 0 and _status = 'synced')`,
      [deckId],
    ),
  );
  const membershipIds = new Set(rows.map((row) => String(row.id)));
  const noteIds = new Set(rows.map((row) => String(row.note_id)));
  if (memberships.some((id) => membershipIds.has(id))) return true;
  if (notes.some((id) => noteIds.has(id))) return true;
  if (!cards.length || noteIds.size === 0) return false;

  const placeholders = [...noteIds].map(() => '?').join(', ');
  const cardRows = await db.read(() =>
    db.driver.query(
      `select id from user_cards where note_id in (${placeholders})`,
      [...noteIds],
    ),
  );
  const cardIds = new Set(cardRows.map((row) => String(row.id)));
  return cards.some((id) => cardIds.has(id));
}
