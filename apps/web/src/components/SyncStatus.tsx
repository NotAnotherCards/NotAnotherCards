import { useTranslation } from 'react-i18next';
import { rejectedSummary } from '@repo/offline-db';
import { useSyncController, useSyncState } from '@/offline/syncProvider';

const rejectionTableKeys: Record<string, string> = {
  user_decks: 'mobile.sync_tables.deck',
  user_notes: 'mobile.sync_tables.note',
  user_cards: 'mobile.sync_tables.card',
  user_note_decks: 'mobile.sync_tables.membership',
  review_events: 'mobile.sync_tables.review',
  user_profiles: 'mobile.sync_tables.profile',
  user_badges: 'mobile.sync_tables.badge',
};

const LABEL_KEYS: Record<string, string> = {
  idle: 'dashboard.sync.synced',
  syncing: 'dashboard.sync.syncing',
  offline: 'dashboard.sync.offline_description',
  error: 'dashboard.sync.failed',
  'resync-required': 'dashboard.sync.recovered',
};

export function SyncStatus() {
  const { t } = useTranslation();
  const controller = useSyncController();
  const state = useSyncState();
  if (!controller) {
    return null;
  }

  const retryable = state.status === 'error' || state.status === 'offline';
  const { count: rejected } = rejectedSummary(state);
  const rejectionDetails = rejected
    ? Object.entries(state.lastResult?.rejectedRecords ?? {})
        .filter(([, ids]) => ids.length > 0)
        .map(([table, ids]) =>
          t(rejectionTableKeys[table] ?? 'mobile.sync_tables.change', {
            count: ids.length,
          }),
        )
        .concat(t('mobile.messages.sync_details'))
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
              ? 'bg-yellow-300'
              : state.status === 'idle'
                ? 'bg-sage-border'
                : state.status === 'syncing'
                  ? 'bg-blue-400'
                  : state.status === 'error'
                    ? 'bg-destructive'
                    : 'bg-yellow-300'
          }`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            rejected
              ? 'bg-yellow-400'
              : state.status === 'idle'
                ? 'bg-sage-foreground'
                : state.status === 'syncing'
                  ? 'bg-blue-500'
                  : state.status === 'error'
                    ? 'bg-destructive'
                    : 'bg-yellow-400'
          }`}
        ></span>
      </span>
      {rejected ? (
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            {t('dashboard.sync.rejected_changes', { count: rejected })}
          </summary>
          <p className="absolute bottom-full right-0 mb-4 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-3 text-foreground shadow-md">
            {rejectionDetails}
          </p>
        </details>
      ) : (
        <span>{t(LABEL_KEYS[state.status] ?? 'dashboard.sync.synced')}</span>
      )}
      {retryable && (
        <button
          type="button"
          className="underline cursor-pointer ml-0.5 hover:text-foreground transition-colors"
          onClick={() => controller.syncNow()}
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
