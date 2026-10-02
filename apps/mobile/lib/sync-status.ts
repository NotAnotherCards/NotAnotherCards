import { useEffect, useState } from 'react';
import type { SyncControllerState } from '@remelondb/core';
import { rejectedSummary } from '@repo/offline-db';
import { t as translate, type TFunction } from 'i18next';

// Web's Overview sync badge (DashboardSyncStatus): same labels, same order
// of precedence, same rejected summary, so the two clients read alike.
export type SyncTone = 'synced' | 'syncing' | 'warning' | 'error';

export interface SyncStatusView {
  label: string;
  tone: SyncTone;
  retryable: boolean;
  details: string | undefined;
}

const LABELS: Record<SyncControllerState['status'], string> = {
  idle: 'dashboard.sync.synced',
  syncing: 'dashboard.sync.syncing',
  offline: 'dashboard.sync.offline',
  error: 'dashboard.sync.failed',
  'resync-required': 'dashboard.sync.reset_required',
};

export function syncStatusView(
  state: SyncControllerState,
  t: TFunction = translate,
): SyncStatusView {
  const { count: rejected } = rejectedSummary(state);
  const tableKeys: Record<string, string> = {
    user_decks: 'deck',
    user_notes: 'note',
    user_cards: 'card',
    user_note_decks: 'membership',
    review_events: 'review',
    user_profiles: 'profile',
    user_badges: 'badge',
  } as const;
  const details = rejected
    ? Object.entries(state.lastResult?.rejectedRecords ?? {})
        .filter(([, ids]) => ids.length > 0)
        .map(([table, ids]) =>
          t(`mobile.sync_tables.${tableKeys[table] ?? 'change'}`, {
            count: ids.length,
          }),
        )
        .concat(t('mobile.messages.sync_details'))
        .join('. ')
    : undefined;
  return {
    label: rejected
      ? t('dashboard.sync.rejected', { rejected })
      : t(LABELS[state.status]),
    tone: rejected
      ? 'warning'
      : state.status === 'idle'
        ? 'synced'
        : state.status === 'syncing'
          ? 'syncing'
          : state.status === 'error'
            ? 'error'
            : 'warning',
    retryable: state.status === 'error' || state.status === 'offline',
    details,
  };
}

// A background sync takes well under a second, every minute; showing each
// one turns the badge into a blinker. "Syncing…" appears only once a run
// has taken longer than this, and every other state shows at once.
export const SYNCING_SHOW_DELAY_MS = 1_000;

export function useSettledSyncState(
  state: SyncControllerState,
): SyncControllerState {
  const [shown, setShown] = useState(state);
  useEffect(() => {
    if (state.status !== 'syncing') {
      setShown(state);
      return;
    }
    const timer = setTimeout(() => setShown(state), SYNCING_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);
  return shown;
}
