import { useSyncController, useSyncState } from '@/offline/syncProvider';

const LABELS: Record<string, string> = {
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline — changes will sync later',
  error: 'Sync failed',
  'resync-required': 'Recovered from a server reset',
};

const TABLE_LABELS: Record<string, string> = {
  user_decks: 'deck',
  user_notes: 'note',
  user_cards: 'card',
  user_note_decks: 'deck membership',
  review_events: 'review',
  user_profiles: 'profile',
  user_badges: 'badge',
};

const REJECTION_EXPLANATION =
  'The server refused these changes. They stay on this device and are sent again with the next sync.';

export function SyncStatus() {
  const controller = useSyncController();
  const state = useSyncState();
  if (!controller) {
    return null;
  }

  const retryable = state.status === 'error' || state.status === 'offline';
  const rejected =
    state.status === 'idle' ? (state.lastResult?.rejected ?? 0) : 0;
  const rejectionDetails = rejected
    ? Object.entries(state.lastResult?.rejectedRecords ?? {})
        .filter(([, ids]) => ids.length > 0)
        .map(([table, ids]) => {
          const label = TABLE_LABELS[table] ?? 'change';
          return `${ids.length} ${label}${ids.length === 1 ? '' : 's'}`;
        })
        .concat(REJECTION_EXPLANATION)
        .join('. ')
    : undefined;
  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-background/90 backdrop-blur-xs border border-border/80 rounded-full shadow-md transition-all duration-300 select-none animate-in fade-in slide-in-from-bottom-2"
      data-testid="sync-status"
      title={rejectionDetails}
    >
      <span className="flex h-2 w-2 relative shrink-0">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            rejected
              ? 'bg-amber-400'
              : state.status === 'idle'
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
            rejected
              ? 'bg-amber-500'
              : state.status === 'idle'
                ? 'bg-emerald-500'
                : state.status === 'syncing'
                  ? 'bg-blue-500'
                  : state.status === 'error'
                    ? 'bg-destructive'
                    : 'bg-amber-500'
          }`}
        ></span>
      </span>
      {rejected ? (
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            Synced, {rejected} {rejected === 1 ? 'change' : 'changes'} not
            accepted
          </summary>
          <p className="absolute bottom-full right-0 mb-4 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-3 text-foreground shadow-md">
            {rejectionDetails}
          </p>
        </details>
      ) : (
        <span>{LABELS[state.status] ?? state.status}</span>
      )}
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
