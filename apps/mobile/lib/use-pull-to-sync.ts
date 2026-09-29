import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SyncController } from '@remelondb/core';

const noController = () => () => {};

// A pull runs a sync and shows its spinner for as long as that sync runs.
// The spinner follows the controller's state, not what syncNow() returns:
// syncNow() only starts the sync. A sync that started by itself shows no
// spinner, and a failed one is reported by the sync status.
export function usePullToSync(controller: SyncController | null) {
  const [pulled, setPulled] = useState(false);
  const status = useSyncExternalStore(
    controller ? (notify) => controller.subscribe(notify) : noController,
    () => controller?.state.status ?? 'idle',
  );
  const syncing = status === 'syncing';

  useEffect(() => {
    if (pulled && !syncing) setPulled(false);
  }, [pulled, syncing]);

  return {
    refreshing: pulled && syncing,
    onRefresh: () => {
      if (!controller) return;
      setPulled(true);
      // Sets the state to syncing before it returns.
      controller.syncNow();
    },
  };
}
