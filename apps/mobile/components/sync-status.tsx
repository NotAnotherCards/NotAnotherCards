import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import type { SyncController } from '@remelondb/core';
import { useSyncState } from '@remelondb/core/react';
import { useSessionDatabase } from '@/lib/database-provider';
import {
  syncStatusView,
  useSettledSyncState,
  type SyncTone,
} from '@/lib/sync-status';
import { Text } from './ui/text';

// One status token per tone; each carries its own light and dark value.
const TONE_CLASSES: Record<SyncTone, { pill: string; text: string }> = {
  synced: { pill: 'bg-success/10', text: 'text-success' },
  syncing: { pill: 'bg-info/10', text: 'text-info' },
  warning: { pill: 'bg-warning/10', text: 'text-warning' },
  error: { pill: 'bg-destructive/10', text: 'text-destructive' },
};

export function SyncStatus() {
  const { t } = useTranslation();
  const { syncController } = useSessionDatabase();
  // No controller: the database is not open (yet), so nothing syncs here.
  // Web says so in plain muted text, not a badge: nothing to wait for.
  if (!syncController) {
    return (
      <Text className="text-xs font-semibold text-muted-foreground">
        {t('dashboard.sync.offline')}
      </Text>
    );
  }
  return <SyncBadge controller={syncController} />;
}

// remelonDB's useSyncState needs a controller, hence the split: hooks
// cannot run on a condition.
function SyncBadge({ controller }: { controller: SyncController }) {
  const { t } = useTranslation();
  const view = syncStatusView(useSettledSyncState(useSyncState(controller)), t);
  const tone = TONE_CLASSES[view.tone];

  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`rounded-full px-2 py-0.5 ${tone.pill}`}
        accessibilityLabel={
          view.details ? `${view.label}. ${view.details}` : view.label
        }
      >
        <Text className={`text-xs font-semibold ${tone.text}`}>
          {view.label}
        </Text>
      </View>
      {view.retryable && (
        <Pressable
          accessibilityRole="button"
          onPress={() => controller.syncNow()}
          hitSlop={8}
        >
          <Text className="text-xs text-muted-foreground underline">
            {t('common.retry')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
