import { useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import { getUserProfileQuery, type UserProfileRecord } from '@repo/offline-db';
import { useSessionDatabase } from '@/lib/database-provider';
import { profileWrites } from '@/lib/profile';
import { switchColors } from '@/lib/theme';
import { Text } from './ui/text';

export function InterfaceLanguagePreference({
  manager,
}: {
  manager: DatabaseManager;
}) {
  const db = useDatabase(manager);
  const profiles = useQuery<UserProfileRecord>(db && getUserProfileQuery(db));
  const profile = profiles.data[0];
  const { syncController } = useSessionDatabase();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const colors = switchColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = profile?.target_language_active ?? false;
  const label = t('dashboard.settings.preferences.use_target_language');

  const update = async (value: boolean) => {
    if (!db || !profile || pending.current) return;
    pending.current = true;
    setSaving(true);
    setFailed(false);
    try {
      const saved = await profileWrites(db, syncController).update({
        target_language_active: value,
      });
      if (!saved) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className="font-medium">{label}</Text>
          <Text className="text-sm text-muted-foreground">
            {t(
              'dashboard.settings.preferences.use_target_language_description',
            )}
          </Text>
        </View>
        <Switch
          accessibilityLabel={label}
          disabled={!db || profiles.isLoading || !profile || saving}
          accessibilityState={{ busy: saving }}
          value={active}
          onValueChange={update}
          trackColor={{ false: colors.trackOff, true: colors.trackOn }}
          thumbColor={active ? colors.thumbOn : colors.thumbOff}
        />
      </View>
      {failed ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          {t('preferences.language_save_error')}
        </Text>
      ) : null}
    </View>
  );
}
