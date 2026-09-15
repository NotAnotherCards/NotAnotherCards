import { useState } from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Settings as SettingsIcon } from 'lucide-react-native';
import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getUserProfileQuery,
  type ReviewPreferences,
  type UserProfileRecord,
} from '@repo/offline-db';
import { authClient } from '@/lib/auth-client';
import { useSessionDatabase } from '@/lib/database-provider';
import {
  loadReviewPreferences,
  saveReviewPreferences,
} from '@/lib/review-preferences';
import { navigationColors } from '@/lib/theme';
import { ThemeToggle } from './theme-toggle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Segmented } from './ui/segmented';
import { Text } from './ui/text';

export function initials(name: string | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
  return letters ? letters.toUpperCase() : 'U';
}

// Web's settings page: an account header, then sections. Preferences is the
// first one; Profile & Languages and Security follow in later slices (#290).
export function Settings() {
  const { data: session } = authClient.useSession();
  const { manager } = useSessionDatabase();
  const user = session?.user;

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
      </View>

      {user ? <Preferences userId={user.id} /> : null}
    </View>
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
  { value: 'basic', label: 'Basic' },
  { value: 'extended', label: 'Extended' },
] as const;

const INTERVAL_OPTIONS = [
  { value: 'hide', label: 'Hide' },
  { value: 'show', label: 'Show' },
] as const;

function Preferences({ userId }: { userId: string }) {
  const { colorScheme } = useColorScheme();
  const iconColor =
    navigationColors[colorScheme === 'dark' ? 'dark' : 'light'].foreground;
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
        <SettingsIcon size={20} color={iconColor} />
        <View>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            How the app looks and how you review
          </CardDescription>
        </View>
      </CardHeader>
      <CardContent className="gap-5">
        <View className="gap-2">
          <Text className="font-medium">Theme</Text>
          <ThemeToggle />
        </View>
        <View className="gap-2">
          <Text className="font-medium">Review mode</Text>
          <Text className="text-sm text-muted-foreground">
            How many answer options you see after revealing a card
          </Text>
          <Segmented
            label="Review mode"
            value={preferences.reviewMode}
            options={MODE_OPTIONS}
            onChange={(reviewMode) => update({ ...preferences, reviewMode })}
          />
        </View>
        <View className="gap-2">
          <Text className="font-medium">Next review interval</Text>
          <Text className="text-sm text-muted-foreground">
            Show when each answer schedules the card next
          </Text>
          <Segmented
            label="Show next review interval"
            value={preferences.showNextReviewInterval ? 'show' : 'hide'}
            options={INTERVAL_OPTIONS}
            onChange={(choice) =>
              update({
                ...preferences,
                showNextReviewInterval: choice === 'show',
              })
            }
          />
        </View>
      </CardContent>
    </Card>
  );
}
