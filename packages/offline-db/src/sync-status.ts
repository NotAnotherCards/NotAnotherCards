import type { SyncControllerState } from '@remelondb/core';

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
