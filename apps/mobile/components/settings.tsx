import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOutIcon, SettingsIcon } from './ui/icon';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getUserProfileQuery,
  type ReviewPreferences,
  type UserProfileRecord,
} from '@repo/offline-db';
import { useColorScheme } from 'nativewind';
import { authClient } from '@/lib/auth-client';
import { useSessionDatabase } from '@/lib/database-provider';
import {
  loadReviewPreferences,
  saveReviewPreferences,
} from '@/lib/review-preferences';
import { profileWrites } from '@/lib/profile';
import { switchColors } from '@/lib/theme';
import { ProfileForm } from './profile-form';
import { ThemeToggle } from './theme-toggle';
import { InterfaceLanguagePreference } from './interface-language-preference';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Segmented } from './ui/segmented';
import { Text } from './ui/text';
import { TwoFactorSecurity } from './two-factor-security';

export function initials(name: string | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
  return letters ? letters.toUpperCase() : 'U';
}

// Web's settings page: an account header, then sections. Preferences is the
// first one; Profile & Languages follows in a later slice (#290).
// Log out lives here, under the account it ends, as in web's account menu.
export function Settings() {
  const { t } = useTranslation();
  const sections = [
    { value: 'profile', label: t('dashboard.settings.tabs.profile_languages') },
    { value: 'preferences', label: t('dashboard.settings.tabs.preferences') },
    { value: 'security', label: t('dashboard.settings.tabs.security') },
  ] as const;
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { manager } = useSessionDatabase();
  const user = session?.user;
  const [section, setSection] = useState<
    'profile' | 'preferences' | 'security'
  >('profile');

  // SessionDatabaseProvider closes the offline database when the session
  // goes away; nothing to do here beyond signing out.
  //
  // @better-auth/expo clears the stored session while the request is being
  // built (its init hook), so whatever the server answers, this device is
  // already logged out and /login is the only coherent destination. What
  // we owe the user is the truth when the server was not reached: the
  // server-side session then lives on until it expires (#237).
  const onLogout = async () => {
    let failed = false;
    try {
      const result = await authClient.signOut();
      failed = result?.error != null;
    } catch {
      failed = true;
    }
    if (failed) {
      Alert.alert(
        t('mobile.messages.local_signout'),
        t('mobile.messages.local_signout_help'),
      );
    }
    router.replace('/login');
  };

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="size-14 items-center justify-center rounded-full bg-primary">
          <Text className="text-xl font-bold text-primary-foreground">
            {initials(user?.name)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold" numberOfLines={1}>
            {user?.name || 'Learner'}
          </Text>
          {manager ? <Username manager={manager} /> : null}
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        {/* Web's account menu item, as an icon button on the account row. */}
        <Button
          variant="outline"
          size="sm"
          onPress={onLogout}
          className="flex-row gap-1.5"
        >
          <LogOutIcon size={16} className="text-destructive" />
          <Text className="text-destructive">
            {t('mobile.messages.logout')}
          </Text>
        </Button>
      </View>

      {/* Web's settings sub-tabs, same order: profile first. */}
      <Segmented
        label={t('dashboard.settings.aria_sections')}
        role="tablist"
        value={section}
        options={sections}
        onChange={setSection}
        stacked
      />

      {section === 'profile' &&
        (manager ? (
          <ProfileSection manager={manager} />
        ) : (
          <View className="items-center py-6">
            <ActivityIndicator />
          </View>
        ))}
      {/* Keyed by account: the preferences are read once per mount. */}
      {section === 'preferences' && user ? (
        <Preferences key={user.id} userId={user.id} />
      ) : null}
      {section === 'security' ? <TwoFactorSecurity /> : null}
    </View>
  );
}

// The synced profile row and the shared write, once the account database
// is open. The form itself is pure and tested on its own.
function ProfileSection({ manager }: { manager: DatabaseManager }) {
  const { syncController } = useSessionDatabase();
  const db = useDatabase(manager);
  const profiles = useQuery<UserProfileRecord>(db && getUserProfileQuery(db));
  if (!db || profiles.isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }
  const writes = profileWrites(db, syncController);
  return (
    <ProfileForm profile={profiles.data[0] ?? null} onSave={writes.update} />
  );
}

// The profile row is synced data; it only exists once the account database
// is open, and the header reads fine without it until then.
function Username({ manager }: { manager: DatabaseManager }) {
  const db = useDatabase(manager);
  const profiles = useQuery<UserProfileRecord>(db && getUserProfileQuery(db));
  const username = profiles.data[0]?.username;
  if (!username) return null;
  return (
    <Text className="text-sm text-muted-foreground" numberOfLines={1}>
      @{username}
    </Text>
  );
}

const MODE_OPTIONS = [
  { value: 'basic', label: 'dashboard.settings.preferences.basic' },
  { value: 'extended', label: 'dashboard.settings.preferences.extended' },
] as const;

function Preferences({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { manager } = useSessionDatabase();
  const { colorScheme } = useColorScheme();
  const colors = switchColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [preferences, setPreferences] = useState(() =>
    loadReviewPreferences(userId),
  );

  const update = (next: ReviewPreferences) => {
    setPreferences(next);
    saveReviewPreferences(userId, next);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <SettingsIcon size={20} className="text-foreground" />
        <View className="flex-1">
          <CardTitle>{t('preferences.title')}</CardTitle>
          <CardDescription>
            {t('dashboard.settings.preferences.description')}
          </CardDescription>
        </View>
      </CardHeader>
      <CardContent className="gap-5">
        <View className="gap-2">
          <Text className="font-medium">
            {t('dashboard.settings.preferences.theme')}
          </Text>
          <ThemeToggle />
        </View>
        {manager ? <InterfaceLanguagePreference manager={manager} /> : null}
        <View className="gap-2">
          <Text className="font-medium">
            {t('dashboard.settings.preferences.review_mode')}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {t('dashboard.settings.preferences.review_mode_description')}
          </Text>
          <Segmented
            label={t('dashboard.settings.preferences.review_mode')}
            value={preferences.reviewMode}
            options={MODE_OPTIONS.map(({ value, label }) => ({
              value,
              label: t(label),
            }))}
            onChange={(reviewMode) => update({ ...preferences, reviewMode })}
          />
        </View>
        {/* Web's row: the label and its description left, the toggle right. */}
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="font-medium">
              {t('dashboard.settings.preferences.show_next_review')}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {t('dashboard.settings.preferences.show_next_review_description')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t(
              'dashboard.settings.preferences.show_next_review',
            )}
            trackColor={{ false: colors.trackOff, true: colors.trackOn }}
            thumbColor={
              preferences.showNextReviewInterval
                ? colors.thumbOn
                : colors.thumbOff
            }
            value={preferences.showNextReviewInterval}
            onValueChange={(showNextReviewInterval) =>
              update({ ...preferences, showNextReviewInterval })
            }
          />
        </View>
      </CardContent>
    </Card>
  );
}
