import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabaseState } from '@remelondb/core/react';
import { useSessionDatabase } from '@/lib/database-provider';
import { Button } from './ui/button';
import { Text } from './ui/text';

// Only the error state is worth showing: on native there are no tabs, so the
// taken-over state is unreachable, and idle/loading/ready need no banner.
export function DatabaseBanner() {
  const { manager } = useSessionDatabase();
  if (!manager) return null;

  return <ActiveDatabaseBanner manager={manager} />;
}

function ActiveDatabaseBanner({ manager }: { manager: DatabaseManager }) {
  const { t } = useTranslation();
  const { status } = useDatabaseState(manager);

  if (status !== 'error') return null;

  return (
    <View className="flex-row items-center justify-between gap-3 bg-destructive px-4 py-3">
      <Text className="flex-1 text-sm text-destructive-foreground">
        {t('mobile.database_unavailable')}
      </Text>
      <Button
        size="sm"
        onPress={() => {
          manager.init().catch(() => {});
        }}
      >
        <Text>{t('common.retry')}</Text>
      </Button>
    </View>
  );
}
