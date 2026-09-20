import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DatabaseManager } from '@remelondb/core';
import { authClient } from '@/lib/auth-client';
import {
  BookOpenIcon,
  LibraryIcon,
  SettingsIcon,
  type LucideIcon,
} from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { DeckList } from '@/components/deck-list';
import { RequireSession } from '@/components/require-session';
import { Settings } from '@/components/settings';
import { useSessionDatabase } from '@/lib/database-provider';
import {
  clearLastReviewDeckId,
  loadLastReviewDeckId,
} from '@/lib/review-preferences';
import { useReviewOverview } from '@/lib/review';

// Web's dashboard strip: Overview, My Library, Profile & Settings, same
// icons. Tab state lives here like web's, no native tab navigator. The
// strip is the screen's top bar; the native header is hidden in _layout.
type Tab = 'overview' | 'library' | 'settings';

const TABS: readonly { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'overview', label: 'Overview', icon: BookOpenIcon },
  { value: 'library', label: 'My Library', icon: LibraryIcon },
  { value: 'settings', label: 'Profile & Settings', icon: SettingsIcon },
];

export default function Dashboard() {
  const { data: session } = authClient.useSession();
  const { manager } = useSessionDatabase();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <RequireSession>
      <View className="flex-1 bg-background">
        <View
          className="border-b border-border bg-card px-4 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Segmented
            label="Dashboard sections"
            role="tablist"
            value={tab}
            options={TABS}
            onChange={setTab}
            stacked
            renderIcon={(value, selected) => {
              const Icon = TABS.find((item) => item.value === value)!.icon;
              return (
                <Icon
                  size={18}
                  className={
                    selected ? 'text-foreground' : 'text-muted-foreground'
                  }
                />
              );
            }}
          />
        </View>
        {/* Settings holds the only text input on this screen; without this
            the first tap on Save only dismisses the keyboard. */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 p-6"
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'overview' && (
            <View className="gap-4">
              {/* The email stays in the Settings account header; the first
                  screen is the one others see over your shoulder. */}
              <Text className="text-base">
                Welcome,{' '}
                <Text className="font-semibold">{session?.user.name}</Text>!
              </Text>
              {manager ? (
                <ReviewOverview
                  manager={manager}
                  userId={session?.user.id}
                  onChooseDeck={() => setTab('library')}
                />
              ) : (
                <ActivityIndicator accessibilityLabel="Loading review overview" />
              )}
            </View>
          )}
          {tab === 'library' && <DeckList />}
          {tab === 'settings' && <Settings />}
        </ScrollView>
      </View>
    </RequireSession>
  );
}

function ReviewOverview({
  manager,
  userId,
  onChooseDeck,
}: {
  manager: DatabaseManager;
  userId: string | undefined;
  onChooseDeck: () => void;
}) {
  const router = useRouter();
  const { dueDeckIds, dueCount, isLoading, error } = useReviewOverview(manager);

  const startReview = () => {
    if (!userId) {
      onChooseDeck();
      return;
    }

    const lastDeckId = loadLastReviewDeckId(userId);
    // Membership in the set covers "deck still exists" too: a deleted deck
    // loses its membership rows (see decksWithDueCards).
    if (lastDeckId && dueDeckIds.has(lastDeckId)) {
      router.push(`/review/${lastDeckId}`);
      return;
    }

    if (lastDeckId) clearLastReviewDeckId(userId);
    onChooseDeck();
  };

  return (
    <View className="gap-3">
      <Text className={error ? 'text-destructive' : 'text-muted-foreground'}>
        {error
          ? `Could not load cards due: ${error.message}`
          : isLoading
            ? 'Loading cards due…'
            : `${dueCount} ${dueCount === 1 ? 'card' : 'cards'} due`}
      </Text>
      <Button loading={isLoading} disabled={!!error} onPress={startReview}>
        <Text>Start review</Text>
      </Button>
    </View>
  );
}
