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

// Web's badge colours, written out whole for nativewind. Raw palette values
// like web's; the move to semantic tokens is tracked in #396.
const TONE_CLASSES: Record<SyncTone, { pill: string; text: string }> = {
  synced: {
    pill: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  syncing: { pill: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  warning: {
    pill: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
  },
  error: { pill: 'bg-destructive/10', text: 'text-destructive' },
};

export function SyncStatus() {
  const { syncController } = useSessionDatabase();
  // No controller: the database is not open (yet), so nothing syncs here.
  // Web says so in plain muted text, not a badge: nothing to wait for.
  if (!syncController) {
    return (
      <Text className="text-xs font-semibold text-muted-foreground">
        Offline
      </Text>
    );
  }
  return <SyncBadge controller={syncController} />;
}

// remelonDB's useSyncState needs a controller, hence the split: hooks
// cannot run on a condition.
function SyncBadge({ controller }: { controller: SyncController }) {
  const view = syncStatusView(useSettledSyncState(useSyncState(controller)));
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
          <Text className="text-xs text-muted-foreground underline">Retry</Text>
        </Pressable>
      )}
    </View>
  );
}
