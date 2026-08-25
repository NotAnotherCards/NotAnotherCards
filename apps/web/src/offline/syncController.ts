export {
  createSyncController,
  type RunSyncResult,
  type SyncController,
  type SyncControllerOptions,
  type SyncControllerState,
  type SyncControllerStatus,
} from '@remelondb/core';

/** Browser wake-ups: back online, tab becomes visible. */
export function browserSyncTriggers(fire: () => void): () => void {
  const onOnline = (): void => fire();
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') fire();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
