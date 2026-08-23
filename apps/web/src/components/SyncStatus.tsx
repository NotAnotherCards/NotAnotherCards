import { useSyncController, useSyncState } from '@/offline/syncProvider';

const LABELS: Record<string, string> = {
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline — changes will sync later',
  error: 'Sync failed',
  'resync-required': 'Recovered from a server reset',
};

export function SyncStatus() {
  const controller = useSyncController();
  const state = useSyncState();
  if (!controller) {
    return null;
  }

  const retryable = state.status === 'error' || state.status === 'offline';
  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-background/90 backdrop-blur-xs border border-border/80 rounded-full shadow-md transition-all duration-300 select-none animate-in fade-in slide-in-from-bottom-2"
      data-testid="sync-status"
    >
      <span className="flex h-2 w-2 relative shrink-0">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            state.status === 'idle'
              ? 'bg-emerald-400'
              : state.status === 'syncing'
                ? 'bg-blue-400'
                : state.status === 'error'
                  ? 'bg-destructive'
                  : 'bg-amber-400'
          }`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            state.status === 'idle'
              ? 'bg-emerald-500'
              : state.status === 'syncing'
                ? 'bg-blue-500'
                : state.status === 'error'
                  ? 'bg-destructive'
                  : 'bg-amber-500'
          }`}
        ></span>
      </span>
      <span>{LABELS[state.status] ?? state.status}</span>
      {retryable && (
        <button
          type="button"
          className="underline cursor-pointer ml-0.5 hover:text-foreground transition-colors"
          onClick={() => controller.syncNow()}
        >
          Retry
        </button>
      )}
    </div>
  );
}
