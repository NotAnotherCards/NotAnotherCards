import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@repo/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
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
import { Library } from '@/components/library';
import { RequireSession } from '@/components/require-session';
import { Settings } from '@/components/settings';
import { InfoPanel } from '@/components/info-panel';
import { SyncStatus } from '@/components/sync-status';
import { useSessionDatabase } from '@/lib/database-provider';
import { usePullToSync } from '@/lib/use-pull-to-sync';
import { loadLastReviewDeckId } from '@/lib/review-preferences';
import { useReviewOverview } from '@/lib/review';
import { dailyGoals, useOverviewStats } from '@/lib/overview-stats';
import { useAchievements, type Achievement } from '@/lib/achievements';

// Web's dashboard strip: Overview, My Library, Profile & Settings, same
// icons. Route params select the tab, with no native tab navigator. The
// strip is the screen's top bar; the native header is hidden in _layout.
type Tab = 'overview' | 'library' | 'settings';

export default function Dashboard() {
  const { t } = useTranslation();
  const tabs: readonly { value: Tab; label: string; icon: LucideIcon }[] = [
    {
      value: 'overview',
      label: t('dashboard.tabs.overview'),
      icon: BookOpenIcon,
    },
    { value: 'library', label: t('dashboard.tabs.library'), icon: LibraryIcon },
    {
      value: 'settings',
      label: t('dashboard.tabs.settings'),
      icon: SettingsIcon,
    },
  ];
  const { data: session } = authClient.useSession();
  const { manager, syncController } = useSessionDatabase();
  const pullToSync = usePullToSync(syncController);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const tab: Tab =
    requestedTab === 'library' || requestedTab === 'settings'
      ? requestedTab
      : 'overview';
  const setTab = (next: Tab) => router.setParams({ tab: next });

  return (
    <RequireSession>
      <View className="flex-1 bg-surface">
        <View
          className="border-b border-border bg-card px-4 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Segmented
            label={t('dashboard.aria_sections')}
            role="tablist"
            value={tab}
            options={tabs}
            onChange={setTab}
            stacked
            renderIcon={(value, selected) => {
              const Icon = tabs.find((item) => item.value === value)!.icon;
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
          // A pull runs a sync; the lists update through their live queries.
          refreshControl={
            <RefreshControl
              refreshing={pullToSync.refreshing}
              onRefresh={pullToSync.onRefresh}
            />
          }
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
                  <Trans
                    t={t}
                    i18nKey="mobile.welcome"
                    values={{ name: session?.user.name ?? '' }}
                    components={{ name: <Text className="font-semibold" /> }}
                  />
                </Text>
                <SyncStatus />
              </View>
              {manager ? (
                <OverviewStatTiles manager={manager} />
              ) : (
                <ActivityIndicator
                  accessibilityLabel={t('mobile.loading_overview')}
                />
              )}
            </View>
          )}
          {tab === 'library' && <Library />}
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
  const { t } = useTranslation();
  const [wrapLabel, setWrapLabel] = useState(false);
  const router = useRouter();
  const { target, dueCount, isLoading, error } = useReviewOverview(
    manager,
    userId ? loadLastReviewDeckId(userId) : null,
  );

  // Without due cards, Start Review opens the library so the learner chooses
  // which deck to continue with and can activate words there.
  const startReview = () => {
    if (target === 'library' || target === 'nothing-due') onChooseDeck();
    else router.push(`/review/${target}`);
  };
  const label =
    isLoading || error
      ? t('dashboard.overview.profile.start_review')
      : t('mobile.start_review_due', { count: dueCount });

  return (
    <View className="gap-2">
      {error && (
        <Text className="text-sm text-destructive">
          {t('mobile.due_error', { message: error.message })}
        </Text>
      )}
      {/* Keep the due count together when the full label needs two lines. */}
      <Button
        size="lg"
        // 48 high, Android's touch target size.
        className="h-auto min-h-12 py-3 sm:h-auto"
        loading={isLoading}
        disabled={!!error}
        onPress={startReview}
      >
        <BookOpenIcon size={18} className="text-primary-foreground" />
        <View className="flex-1">
          {/* Measure the unsplit label so resizing can restore one line. */}
          <Text
            testID="review-label-measure"
            className="absolute w-full text-center opacity-0"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onTextLayout={({ nativeEvent }) =>
              setWrapLabel(nativeEvent.lines.length > 1)
            }
          >
            {label}
          </Text>
          <Text className="text-center">
            {wrapLabel ? label.replace(' · ', '\n') : label}
          </Text>
        </View>
      </Button>
    </View>
  );
}

// Web's Overview stat tiles, with web's titles and colours.
// Each tile keeps a raw hue like web's: it tells the tiles apart and states
// nothing, so no status token fits (docs/design.md, Enforcement). Full class
// names, not concatenated: nativewind only sees classes written out whole.
function OverviewStatTiles({ manager }: { manager: DatabaseManager }) {
  const { t, i18n } = useTranslation();
  const { stats, isLoading, error } = useOverviewStats(manager);

  if (error) {
    return (
      <Text className="text-destructive">
        {t('mobile.statistics_error', { message: error.message })}
      </Text>
    );
  }
  if (isLoading || !stats) {
    return (
      <ActivityIndicator accessibilityLabel={t('mobile.loading_statistics')} />
    );
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
      title: t('dashboard.overview.stats.personal_dictionary'),
      value: t('dashboard.overview.stats.words', {
        count: stats.dictionarySize,
      }),
      description: t('dashboard.overview.stats.added_to_collection'),
      icon: BookMarkedIcon,
      iconClass: 'text-blue-500',
      iconBoxClass: 'bg-blue-500/10',
    },
    {
      title: t('dashboard.overview.stats.learning_streak'),
      value: t('dashboard.overview.stats.days', { count: stats.streak }),
      description: t('dashboard.overview.stats.daily_streak'),
      icon: FlameIcon,
      iconClass: 'text-orange-500',
      iconBoxClass: 'bg-orange-500/10',
    },
    {
      title: t('dashboard.overview.stats.words_learned'),
      value: formatNumber(stats.wordsLearned, i18n.resolvedLanguage),
      description: t('dashboard.overview.stats.notes_reviewed'),
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
              <View>
                {title.split(/\s+/).map((word, index) => (
                  <CardDescription
                    key={`${index}-${word}`}
                    className="text-xs"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {word}
                  </CardDescription>
                ))}
              </View>
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
  const { t } = useTranslation();
  const goals = dailyGoals(challenges, t);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <View className="flex-row items-center gap-2">
          <SparklesIcon size={16} className="text-warning" />
          <CardTitle className="flex-1 text-base">
            {t('dashboard.overview.goals.daily_learning_goals')}
          </CardTitle>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.goal_rules')}
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
                    ? 'font-semibold text-success'
                    : 'text-muted-foreground'
                }`}
              >
                {goal.completed
                  ? t('dashboard.overview.goals.completed')
                  : goal.progress}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {goal.description}
            </Text>
            <Progress
              value={goal.percent}
              accessibilityLabel={t('mobile.goal_progress', {
                goal: goal.title,
              })}
              className="h-1.5"
              indicatorClassName="bg-warning"
            />
          </View>
        ))}
      </CardContent>
      {showRules && (
        <InfoPanel
          title={t('mobile.goal_rules')}
          onClose={() => setShowRules(false)}
        >
          <Text className="text-sm text-muted-foreground">
            {t('dashboard.overview.goals.footer_points')}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {t('dashboard.overview.goals.footer_reset')}
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
// primary colour like web's (neither client gives badges a colour of
// their own yet), locked ones faded (web greys them with a CSS filter,
// which React Native lacks). A tap opens the rule, story and date.
function AchievementsCard({ manager }: { manager: DatabaseManager }) {
  const { t, i18n } = useTranslation();
  const { achievements, isLoading, error } = useAchievements(manager);
  const [openCode, setOpen] = useState<Achievement['code'] | null>(null);
  const open = achievements.find((badge) => badge.code === openCode);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <View className="flex-row items-center gap-2">
          <TrophyIcon size={16} className="text-primary" />
          <CardTitle className="text-base">
            {t('dashboard.overview.achievements.title')}
          </CardTitle>
        </View>
      </CardHeader>
      <CardContent className="px-4">
        {error ? (
          <Text className="text-sm text-destructive">
            {t('mobile.badges_error', { message: error.message })}
          </Text>
        ) : isLoading ? (
          <ActivityIndicator accessibilityLabel={t('mobile.loading_badges')} />
        ) : (
          <View className="flex-row gap-3">
            {achievements.map((badge) => {
              const Icon = BADGE_ICONS[badge.code];
              const unlocked = badge.unlockedAt !== null;
              return (
                <Pressable
                  key={badge.code}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    unlocked ? 'mobile.badge_unlocked' : 'mobile.badge_locked',
                    { name: badge.name },
                  )}
                  onPress={() => setOpen(badge.code)}
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
              ? t('dashboard.overview.achievements.unlocked', {
                  date: formatDate(open.unlockedAt, i18n.resolvedLanguage),
                })
              : t('dashboard.overview.achievements.locked')}
          </Text>
        </InfoPanel>
      )}
    </Card>
  );
}
