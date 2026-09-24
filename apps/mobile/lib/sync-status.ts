import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { SyncController, SyncControllerState } from '@remelondb/core';
import { rejectedSummary } from '@repo/offline-db';

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
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync failed',
  'resync-required': 'Reset required',
};

export function syncStatusView(
  state: SyncControllerState | null,
): SyncStatusView {
  // No controller: signed out or the database is not open yet
  if (!state) {
    return {
      label: 'Offline',
      tone: 'warning',
      retryable: false,
      details: undefined,
    };
  }

  const { count: rejected, details } = rejectedSummary(state);
  return {
    label: rejected
      ? `Synced, ${rejected} not accepted`
      : (LABELS[state.status] ?? state.status),
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
  state: SyncControllerState | null,
): SyncControllerState | null {
  const [shown, setShown] = useState(state);
  useEffect(() => {
    if (state?.status !== 'syncing') {
      setShown(state);
      return;
    }
    const timer = setTimeout(() => setShown(state), SYNCING_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);
  return shown;
}

export function useSyncState(
  controller: SyncController | null,
): SyncControllerState | null {
  const subscribe = useCallback(
    (onChange: () => void) =>
      controller ? controller.subscribe(onChange) : () => {},
    [controller],
  );
  return useSyncExternalStore(subscribe, () =>
    controller ? controller.state : null,
  );
}
