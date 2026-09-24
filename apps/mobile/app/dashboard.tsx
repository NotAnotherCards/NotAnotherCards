import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DatabaseManager } from '@remelondb/core';
import { authClient } from '@/lib/auth-client';
import {
  BookMarkedIcon,
  BookOpenIcon,
  FlameIcon,
  GraduationCapIcon,
  InfoIcon,
  LibraryIcon,
  MedalIcon,
  SettingsIcon,
  SparklesIcon,
  TrophyIcon,
  type LucideIcon,
} from '@/components/ui/icon';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { DeckList } from '@/components/deck-list';
import { RequireSession } from '@/components/require-session';
import { Settings } from '@/components/settings';
import { InfoPanel } from '@/components/info-panel';
import { SyncStatus } from '@/components/sync-status';
import { useSessionDatabase } from '@/lib/database-provider';
import {
  clearLastReviewDeckId,
  loadLastReviewDeckId,
} from '@/lib/review-preferences';
import { useReviewOverview } from '@/lib/review';
import { dailyGoals, useOverviewStats } from '@/lib/overview-stats';
import { useAchievements, type Achievement } from '@/lib/achievements';

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
          contentContainerClassName="grow gap-4 p-6"
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'overview' && (
            // Greeting, tiles, goals and badges share the free height
            // evenly, above and below each: on a tall phone they spread
            // out, on a small one they close up to gap-4.
            <View className="flex-1 justify-evenly gap-4">
              <View className="flex-row items-center justify-between gap-3">
                {/* The email stays in the Settings account header; the first
                    screen is the one others see over your shoulder. */}
                <Text className="flex-1 text-base" numberOfLines={1}>
                  Welcome,{' '}
                  <Text className="font-semibold">{session?.user.name}</Text>!
                </Text>
                <SyncStatus />
              </View>
              {manager ? (
                <OverviewStatTiles manager={manager} />
              ) : (
                <ActivityIndicator accessibilityLabel="Loading review overview" />
              )}
            </View>
          )}
          {tab === 'library' && <DeckList />}
          {tab === 'settings' && <Settings />}
        </ScrollView>
        {/* Start Review sits under the thumb, below the scrolling content,
            on the page colour; the line marks where content scrolls under. */}
        {tab === 'overview' && manager && (
          <View
            className="border-t border-border bg-background px-6 pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <StartReviewBar
              manager={manager}
              userId={session?.user.id}
              onChooseDeck={() => setTab('library')}
            />
          </View>
        )}
      </View>
    </RequireSession>
  );
}

function StartReviewBar({
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
    <View className="gap-2">
      {error && (
        <Text className="text-sm text-destructive">
          Could not load cards due: {error.message}
        </Text>
      )}
      {/* The same button as each library row, so the two read as one
          action; the due count rides along instead of a line of its own. */}
      <Button
        variant="outline"
        size="lg"
        loading={isLoading}
        disabled={!!error}
        onPress={startReview}
      >
        <BookOpenIcon size={18} className="text-foreground" />
        <Text>
          {isLoading || error
            ? 'Start Review'
            : `Start Review · ${dueCount} due`}
        </Text>
      </Button>
    </View>
  );
}

// Web's Overview stat tiles, with web's titles and colours.
// The colours are raw palette values like web's, which docs/design.md rules
// out; both clients move to semantic tokens together (#396). Full class
// names, not concatenated: nativewind only sees classes written out whole.
function OverviewStatTiles({ manager }: { manager: DatabaseManager }) {
  const { stats, isLoading, error } = useOverviewStats(manager);

  if (error) {
    return (
      <Text className="text-destructive">
        Could not load your statistics: {error.message}
      </Text>
    );
  }
  if (isLoading || !stats) {
    return <ActivityIndicator accessibilityLabel="Loading statistics" />;
  }

  const tiles: readonly {
    title: string;
    value: string;
    description: string;
    icon: LucideIcon;
    iconClass: string;
    iconBoxClass: string;
  }[] = [
    {
      title: 'Personal Dictionary',
      value: `${stats.dictionarySize} ${stats.dictionarySize === 1 ? 'card' : 'cards'}`,
      description: 'Added to your collection',
      icon: BookMarkedIcon,
      iconClass: 'text-blue-500',
      iconBoxClass: 'bg-blue-500/10',
    },
    {
      title: 'Learning Streak',
      value: `${stats.streak} ${stats.streak === 1 ? 'Day' : 'Days'}`,
      description: 'Daily learning-day streak',
      icon: FlameIcon,
      iconClass: 'text-orange-500',
      iconBoxClass: 'bg-orange-500/10',
    },
    {
      title: 'Words Learned',
      value: stats.wordsLearned.toLocaleString(),
      description: 'Notes reviewed successfully',
      icon: GraduationCapIcon,
      iconClass: 'text-purple-500',
      iconBoxClass: 'bg-purple-500/10',
    },
  ];

  // A fragment: the three sections sit directly in the Overview's column,
  // next to the greeting, so the free height is shared by all four.
  return (
    <>
      {/* One row of three: a third of a phone has room for icon, value
          and title, not for web's description line, which screen readers
          still get. */}
      <View role="list" className="flex-row gap-3">
        {tiles.map(
          ({
            title,
            value,
            description,
            icon: Icon,
            iconClass,
            iconBoxClass,
          }) => (
            <Card
              key={title}
              role="listitem"
              accessible
              accessibilityLabel={`${title}: ${value}. ${description}`}
              className="flex-1 gap-2 px-3 py-3"
            >
              <View className={`self-start rounded-xl p-2 ${iconBoxClass}`}>
                <Icon size={18} className={iconClass} />
              </View>
              <CardTitle
                className="text-lg"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {value}
              </CardTitle>
              <CardDescription className="text-xs">{title}</CardDescription>
            </Card>
          ),
        )}
      </View>
      <DailyGoalsCard challenges={stats.challenges} />
      <AchievementsCard manager={manager} />
    </>
  );
}

// Web's Daily Learning Goals: each goal's title, count, description and
// bar. The rules below web's goals open from the info button instead.
function DailyGoalsCard({
  challenges,
}: {
  challenges: Parameters<typeof dailyGoals>[0];
}) {
  const [showRules, setShowRules] = useState(false);
  const goals = dailyGoals(challenges);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <View className="flex-row items-center gap-2">
          <SparklesIcon size={16} className="text-amber-500" />
          <CardTitle className="flex-1 text-base">
            Daily Learning Goals
          </CardTitle>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How daily goals count"
            onPress={() => setShowRules(true)}
            hitSlop={12}
          >
            <InfoIcon size={18} className="text-muted-foreground" />
          </Pressable>
        </View>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        {goals.map((goal) => (
          <View key={goal.code} className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold">{goal.title}</Text>
              <Text
                className={`text-xs ${
                  goal.completed
                    ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
                }`}
              >
                {goal.completed ? 'Completed' : goal.progress}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {goal.description}
            </Text>
            {/* The track takes the page colour: a mobile card is the muted
                tone already (docs/design.md), so web's track would not show. */}
            <Progress
              value={goal.percent}
              accessibilityLabel={`${goal.title} progress`}
              className="h-1.5 bg-background"
              indicatorClassName="bg-amber-500"
            />
          </View>
        ))}
      </CardContent>
      {showRules && (
        <InfoPanel
          title="How daily goals count"
          onClose={() => setShowRules(false)}
        >
          <Text className="text-sm text-muted-foreground">
            One review earns one point regardless of rating.
          </Text>
          <Text className="text-sm text-muted-foreground">
            Daily challenges and streaks reset at 00:00 UTC.
          </Text>
        </InfoPanel>
      )}
    </Card>
  );
}

const BADGE_ICONS: Record<Achievement['code'], LucideIcon> = {
  'first-review': MedalIcon,
  'seven-day-streak': FlameIcon,
  'hundred-reviews': TrophyIcon,
};

// Web's Achievements, as one row of three badges: unlocked ones in the
// primary colour like web's (colours for both clients come with the
// tokens, #396), locked ones faded (web greys them with a CSS filter,
// which React Native lacks). A tap opens the rule, story and date.
function AchievementsCard({ manager }: { manager: DatabaseManager }) {
  const { achievements, isLoading, error } = useAchievements(manager);
  const [open, setOpen] = useState<Achievement | null>(null);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <View className="flex-row items-center gap-2">
          <TrophyIcon size={16} className="text-primary" />
          <CardTitle className="text-base">Achievements</CardTitle>
        </View>
      </CardHeader>
      <CardContent className="px-4">
        {error ? (
          <Text className="text-sm text-destructive">
            Could not load your badges: {error.message}
          </Text>
        ) : isLoading ? (
          <ActivityIndicator accessibilityLabel="Loading badges" />
        ) : (
          <View className="flex-row gap-3">
            {achievements.map((badge) => {
              const Icon = BADGE_ICONS[badge.code];
              const unlocked = badge.unlockedAt !== null;
              return (
                <Pressable
                  key={badge.code}
                  accessibilityRole="button"
                  accessibilityLabel={`${badge.name}, ${
                    unlocked ? 'unlocked' : 'locked'
                  }`}
                  onPress={() => setOpen(badge)}
                  className={`flex-1 items-center gap-1.5 rounded-xl border px-1 py-3 ${
                    unlocked
                      ? 'border-primary/20 bg-primary/5'
                      : 'border-border bg-background opacity-50'
                  }`}
                >
                  <View
                    className={`rounded-full p-2.5 ${
                      unlocked ? 'bg-primary/20' : 'bg-muted'
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        unlocked ? 'text-primary' : 'text-muted-foreground'
                      }
                    />
                  </View>
                  <Text className="text-center text-xs font-semibold">
                    {badge.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </CardContent>
      {open && (
        <InfoPanel title={open.name} onClose={() => setOpen(null)}>
          <Text className="text-sm font-medium">{open.rule}</Text>
          <Text className="text-sm text-muted-foreground">
            {open.description}
          </Text>
          <Text
            className={`text-sm ${
              open.unlockedAt !== null
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            {open.unlockedAt !== null
              ? `Unlocked: ${new Date(open.unlockedAt).toLocaleDateString()}`
              : 'Locked'}
          </Text>
        </InfoPanel>
      )}
    </Card>
  );
}
