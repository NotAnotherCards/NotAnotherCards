import { useEffect, useRef, useState } from 'react';
import type { SyncController } from '@remelondb/core';

// A pull runs a sync and shows its spinner until that sync settles.
// syncNow() resolves, never rejects, once the run it started or joined has
// finished, so a sync that started by itself shows no spinner, and a failed
// one is reported by the sync status rather than here.
export function usePullToSync(controller: SyncController | null) {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    refreshing,
    onRefresh: () => {
      if (!controller) return;
      setRefreshing(true);
      void controller.syncNow().then(() => {
        if (mounted.current) setRefreshing(false);
      });
    },
  };
}
