import { useState, useEffect, useMemo } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Clock,
  BookMarked,
  Flame,
  GraduationCap,
  BookOpen,
  Sparkles,
  Mail,
  Library,
  RefreshCw,
  Loader2,
  AlertCircle,
  Flag,
  Trophy,
  Medal,
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSharedDecks } from '@/hooks/useSharedDecks';
import { useImportDeck } from '@/hooks/useImportDeck';
import { useReportDeck } from '@/hooks/useReportDeck';
import { useStore } from '@/hooks/useStore';
import { useSyncController, useSyncState } from '@/offline/syncProvider';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  clearLastReviewDeckId,
  getLastReviewDeckId,
} from '@/lib/review-preferences';
import { gamificationMeSchema, type SharedDeckSummary } from '@repo/schemas';
import {
  selectTodayChallengeActivity,
  selectLearnedNoteCount,
  selectStreakActivity,
  type DailyChallengeProgress,
} from '@repo/offline-db/activity';
import { useQuery } from '@remelondb/core/react';
import {
  getReviewHistoryQuery,
  type ReviewEventRecord,
  UserBadge,
  type UserBadgeRecord,
  rejectedSummary,
} from '@repo/offline-db';
import { formatNumber, formatDate } from '@repo/i18n';

type OverviewProps = {
  onChooseDeck: () => void;
};

const NOTIFIED_STORAGE_KEY = 'gamification_notified_today';
const BADGE_NOTIFIED_STORAGE_KEY = 'gamification_badges_notified';

function getBadges(t: (key: string) => string) {
  return [
    {
      id: 'first-review',
      name: t('dashboard.overview.badges.first_review.name'),
      rule: t('dashboard.overview.badges.first_review.rule'),
      description: t('dashboard.overview.badges.first_review.description'),
      icon: Medal,
    },
    {
      id: 'seven-day-streak',
      name: t('dashboard.overview.badges.seven_day.name'),
      rule: t('dashboard.overview.badges.seven_day.rule'),
      description: t('dashboard.overview.badges.seven_day.description'),
      icon: Flame,
    },
    {
      id: 'hundred-reviews',
      name: t('dashboard.overview.badges.hundred_reviews.name'),
      rule: t('dashboard.overview.badges.hundred_reviews.rule'),
      description: t('dashboard.overview.badges.hundred_reviews.description'),
      icon: Trophy,
    },
  ];
}

function DashboardSyncStatus() {
  const { t } = useTranslation();
  const controller = useSyncController();
  const state = useSyncState();

  if (!controller) {
    return (
      <span className="text-muted-foreground font-semibold">
        {t('dashboard.sync.offline')}
      </span>
    );
  }

  const LABELS: Record<string, string> = {
    idle: t('dashboard.sync.synced'),
    syncing: t('dashboard.sync.syncing'),
    offline: t('dashboard.sync.offline'),
    error: t('dashboard.sync.failed'),
    'resync-required': t('dashboard.sync.reset_required'),
  };

  const { count: rejected, details: rejectionDetails } = rejectedSummary(state);
  const statusColor = rejected
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    : state.status === 'idle'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : state.status === 'syncing'
        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse'
        : state.status === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400';

  return (
    <div className="flex items-center gap-1.5 font-semibold">
      <span
        className={`px-2 py-0.5 rounded-full ${statusColor}`}
        title={rejectionDetails}
      >
        {rejected
          ? t('dashboard.sync.rejected', { rejected })
          : (LABELS[state.status] ?? state.status)}
      </span>
      {(state.status === 'error' || state.status === 'offline') && (
        <button
          type="button"
          onClick={() => controller.syncNow()}
          className="flex items-center gap-1 underline text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-normal"
        >
          <RefreshCw className="size-3" />
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Overview({ onChooseDeck }: OverviewProps) {
  const { t } = useTranslation();
  const store = useStore();
  const { data: reviewEvents } = useQuery<ReviewEventRecord>(
    store.db && getReviewHistoryQuery(store.db),
  );
  const { data: userBadges } = useQuery<UserBadgeRecord>(
    store.db && store.db.get(UserBadge).query(),
  );
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const controller = useSyncController();
  const {
    decks: sharedDecks,
    isLoading: isSharedDecksLoading,
    error: sharedDecksError,
  } = useSharedDecks();
  const { importDeck, importingIds, error: importError } = useImportDeck();
  const {
    reportDeck,
    reportingIds,
    error: reportError,
    setError: setReportError,
  } = useReportDeck();
  const [reportingDeck, setReportingDeck] = useState<SharedDeckSummary | null>(
    null,
  );
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const streak = selectStreakActivity(reviewEvents, Date.now()).currentStreak;
  const learnedNotes = selectLearnedNoteCount(
    reviewEvents,
    store.cards,
    store.notes,
  );
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || 'en';

  const user = session?.user || {
    name: 'Legendary Learner',
    email: 'learner@notanothercards.com',
  };

  const handleStartReview = () => {
    const userId = session?.user.id;
    if (!userId) {
      onChooseDeck();
      return;
    }

    const lastDeckId = getLastReviewDeckId(userId);
    const lastDeckStillExists = (store.decks || []).some(
      (deck) => deck.id === lastDeckId,
    );

    if (lastDeckId && lastDeckStillExists) {
      void navigate({ to: '/deck-review', search: { deckId: lastDeckId } });
      return;
    }

    if (lastDeckId) clearLastReviewDeckId(userId);
    onChooseDeck();
  };

  // Dynamic statistics from local remelonDB store
  const stats = [
    {
      title: t('dashboard.overview.stats.today_reviews'),
      value: t('dashboard.overview.stats.cards', {
        value: store.dueCards?.length ?? 0,
      }),
      description: t('dashboard.overview.stats.due_for_review'),
      icon: Clock,
      color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      title: t('dashboard.overview.stats.personal_dictionary'),
      value: t('dashboard.overview.stats.words', {
        value: new Set((store.noteDecks || []).map((nd) => nd.note_id)).size,
      }),
      description: t('dashboard.overview.stats.added_to_collection'),
      icon: BookMarked,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      title: t('dashboard.overview.stats.learning_streak'),
      value:
        streak === 1
          ? t('dashboard.overview.stats.days_one')
          : t('dashboard.overview.stats.days_other', { count: streak }),
      description: t('dashboard.overview.stats.daily_streak'),
      icon: Flame,
      color: 'text-orange-500 bg-orange-500/10',
    },
    {
      title: t('dashboard.overview.stats.words_learned'),
      value: formatNumber(learnedNotes, locale),
      description: t('dashboard.overview.stats.notes_reviewed'),
      icon: GraduationCap,
      color: 'text-purple-500 bg-purple-500/10',
    },
  ];

  const [serverProgress, setServerProgress] = useState<{
    utcDate: string;
    challenges: DailyChallengeProgress[];
  } | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [badgeNotifications, setBadgeNotifications] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const syncState = useSyncState();
  const lastSuccessfulSync = syncState.lastSyncAt;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const localActivity = useMemo(() => {
    return selectTodayChallengeActivity(
      reviewEvents ?? [],
      store.notes ?? [],
      currentTime,
    );
  }, [reviewEvents, store.notes, currentTime]);

  // Reconcile with server
  useEffect(() => {
    const ac = new AbortController();
    async function fetchGamification() {
      try {
        const res = await fetch('/api/gamification/me', { signal: ac.signal });
        if (res.ok) {
          const parsed = gamificationMeSchema.safeParse(await res.json());
          if (parsed.success) {
            setServerProgress({
              utcDate: parsed.data.utcDate,
              challenges: parsed.data.todayChallenges,
            });
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          // Silently fallback to local progress
        }
      }
    }
    void fetchGamification();

    return () => ac.abort();
  }, [lastSuccessfulSync, localActivity.utcDate]);

  // Merge server and local progress
  const challenges = useMemo(() => {
    const merged = [...(localActivity.challenges || [])];
    if (serverProgress && serverProgress.utcDate === localActivity.utcDate) {
      for (let i = 0; i < merged.length; i++) {
        const serverMatch = serverProgress.challenges.find(
          (c) => c.code === merged[i].code,
        );
        if (serverMatch && serverMatch.completed && !merged[i].completed) {
          merged[i] = {
            ...merged[i],
            completed: true,
            current: serverMatch.current,
          };
        }
      }
    }
    return merged;
  }, [localActivity, serverProgress]);

  // Handle notifications
  useEffect(() => {
    // Only process notifications once the local DB is fully initialized
    if (!store.ready || !session?.user?.id) return;

    // We use UTC date to match the gamification reset logic
    const todayStr = localActivity.utcDate;

    let notifiedState = { date: '', codes: [] as string[] };
    const storageKey = `${NOTIFIED_STORAGE_KEY}_${session.user.id}`;
    try {
      const stored = localStorage.getItem(storageKey);
      const isNotifiedState = (
        d: unknown,
      ): d is { date: string; codes: string[] } => {
        return typeof d === 'object' && d !== null;
      };

      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (isNotifiedState(parsed)) {
          notifiedState = {
            date: typeof parsed.date === 'string' ? parsed.date : '',
            codes: Array.isArray(parsed.codes) ? parsed.codes : [],
          };
        }
      }

      if (notifiedState.date !== todayStr) {
        notifiedState = { date: todayStr, codes: [] };
      }

      const newCompletions: string[] = [];
      let updatedStorage = false;

      challenges.forEach((challenge) => {
        if (
          challenge.completed &&
          !notifiedState.codes.includes(challenge.code)
        ) {
          notifiedState.codes.push(challenge.code);
          newCompletions.push(challenge.code);
          updatedStorage = true;
        }
      });

      if (updatedStorage) {
        localStorage.setItem(storageKey, JSON.stringify(notifiedState));
      }

      if (newCompletions.length > 0) {
        setNotifications((prev) => [...prev, ...newCompletions]);

        setTimeout(() => {
          setNotifications((prev) =>
            prev.filter((n) => !newCompletions.includes(n)),
          );
        }, 5000);
      }
    } catch {
      // Ignore parse and storage errors
    }
  }, [challenges, store.ready, session?.user?.id, localActivity.utcDate]);

  // Handle Badge Notifications
  useEffect(() => {
    if (!store.ready || !userBadges) return;

    const storageKey = `${BADGE_NOTIFIED_STORAGE_KEY}_${session?.user.id}`;
    let notifiedBadges: string[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (
          Array.isArray(parsed) &&
          parsed.every((item) => typeof item === 'string')
        ) {
          notifiedBadges = parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }

    const newBadges: string[] = [];
    let updatedStorage = false;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    userBadges.forEach((badge) => {
      if (!notifiedBadges.includes(badge.badge_id)) {
        notifiedBadges.push(badge.badge_id);
        updatedStorage = true;

        // Only show notifications for recently unlocked badges (last 24 hours)
        // This prevents notification spam when logging into a new device
        if (now - badge.unlocked_at < ONE_DAY_MS) {
          newBadges.push(badge.badge_id);
        }
      }
    });

    if (updatedStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(notifiedBadges));
      } catch (err) {
        console.error(
          'Failed to save badge notifications to localStorage:',
          err,
        );
      }
    }

    if (newBadges.length > 0) {
      setBadgeNotifications((prev) => [...prev, ...newBadges]);

      setTimeout(() => {
        setBadgeNotifications((prev) =>
          prev.filter((b) => !newBadges.includes(b)),
        );
      }, 6000);
    }
  }, [userBadges, store.ready, session?.user.id]);

  // Map to dailyGoals format
  const dailyGoals = challenges.map((challenge, index) => {
    const isReview = challenge.code === 'daily-review';
    return {
      id: index + 1,
      title: isReview
        ? t('dashboard.overview.goals.daily_review')
        : t('dashboard.overview.goals.new_vocabulary'),
      description: isReview
        ? t('dashboard.overview.goals.review_20_words')
        : t('dashboard.overview.goals.add_5_words'),
      progress: `${challenge.current} / ${challenge.target}`,
      percent: Math.min(
        100,
        Math.round((challenge.current / challenge.target) * 100),
      ),
      reward: challenge.completed
        ? t('dashboard.overview.goals.completed')
        : t('dashboard.overview.goals.remaining', {
            value: Math.max(0, challenge.target - challenge.current),
          }),
    };
  });
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Overview Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center gap-4 pb-4">
            <div className="size-14 rounded-full bg-linear-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-xl shadow-inner border border-primary/20">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <CardTitle
                className="text-lg font-bold truncate max-w-50"
                title={user.name}
              >
                {user.name}
              </CardTitle>
              <CardDescription
                className="flex items-center gap-1 text-xs truncate max-w-50"
                title={user.email}
              >
                <Mail className="size-3" />
                {user.email}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/30 text-xs">
              <span className="text-muted-foreground">
                {t('dashboard.overview.profile.status')}
              </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
                  isOnline
                    ? 'bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive animate-pulse'
                }`}
              >
                {isOnline
                  ? t('dashboard.overview.profile.online')
                  : t('dashboard.overview.profile.offline')}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/30 text-xs">
              <span className="text-muted-foreground">
                {t('dashboard.overview.profile.sync')}
              </span>
              <DashboardSyncStatus />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 cursor-pointer gap-1.5"
                size="sm"
                onClick={handleStartReview}
              >
                <Library className="size-3.5" />
                {t('dashboard.overview.profile.start_review')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary Cards Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card
                key={i}
                className="border border-border/60 hover:shadow-md transition-all duration-300"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </span>
                  <div className={`p-2 rounded-xl ${stat.color}`}>
                    <Icon className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-heading tracking-tight">
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tables and List sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Explore Dictionaries */}
        <Card className="lg:col-span-2 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              {t('dashboard.overview.community.title')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.overview.community.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(importError || (reportError && !reportingDeck)) && (
              <div className="mx-6 mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 flex items-center gap-2">
                <AlertCircle className="size-4" />
                {importError ?? reportError}
              </div>
            )}
            <div className="overflow-x-auto">
              {isSharedDecksLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : sharedDecksError ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {t('dashboard.overview.community.load_failed')}
                </div>
              ) : sharedDecks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {t('dashboard.overview.community.empty')}
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground">
                      <th className="px-6 py-3">
                        {t('dashboard.overview.community.deck_name')}
                      </th>
                      <th className="px-6 py-3">
                        {t('dashboard.overview.community.deck_description')}
                      </th>
                      <th className="px-6 py-3">
                        {t('dashboard.overview.community.cards')}
                      </th>
                      <th className="px-6 py-3 text-right">
                        {t('dashboard.overview.community.action')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sharedDecks.map((deck) => (
                      <tr
                        key={deck.id}
                        className="hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-6 py-3.5 font-medium flex items-center gap-2">
                          <div className="size-6 rounded-full bg-muted flex shrink-0 items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {deck.owner.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">
                              {deck.title ||
                                t('dashboard.overview.community.untitled')}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal truncate">
                              {t('dashboard.overview.community.by_user', {
                                username: deck.owner.username,
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground max-w-50 truncate">
                          {deck.description || '-'}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs text-muted-foreground">
                            {deck.cardCount}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer"
                              disabled={reportingIds.has(deck.id)}
                              aria-label={`Report ${deck.title || 'deck'}`}
                              onClick={() => {
                                setReportError(null);
                                setReportReason('');
                                setReportSubmitted(false);
                                setReportingDeck(deck);
                              }}
                            >
                              <Flag className="size-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="cursor-pointer min-w-17.5"
                              disabled={importingIds.has(deck.id)}
                              onClick={async () => {
                                const result = await importDeck(deck.id);
                                if (result) {
                                  controller?.syncNow();
                                }
                              }}
                            >
                              {importingIds.has(deck.id) ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                t('dashboard.overview.community.import')
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Daily Learning Goals */}
        <Card className="lg:col-span-1 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              {t('dashboard.overview.goals.daily_learning_goals')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.overview.goals.daily_learning_goals_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {dailyGoals.map((quest) => (
              <div key={quest.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {quest.title}
                  </span>
                  <span className="text-muted-foreground font-medium">
                    {quest.progress}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {quest.description}
                </p>
                <Progress
                  value={quest.percent}
                  aria-label={`${quest.title} progress`}
                  className="h-1.5 w-full"
                  indicatorClassName="bg-linear-to-r from-amber-500 to-amber-400"
                />
                <div className="flex justify-end">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      quest.percent === 100
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {quest.reward}
                  </span>
                </div>
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-border/40 text-[10px] text-muted-foreground leading-relaxed">
              <p>{t('dashboard.overview.goals.footer_points')}</p>
              <p>{t('dashboard.overview.goals.footer_reset')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card className="border border-border/60 hover:shadow-md transition-all duration-300">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            {t('dashboard.overview.achievements.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.overview.achievements.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {getBadges(t).map((badgeDef) => {
              const earned = userBadges?.find(
                (b) => b.badge_id === badgeDef.id,
              );
              const Icon = badgeDef.icon;
              return (
                <div
                  key={badgeDef.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                    earned
                      ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                      : 'bg-muted/30 border-border/40 opacity-70 grayscale'
                  }`}
                >
                  <div
                    className={`p-3 rounded-full shrink-0 ${
                      earned
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      {badgeDef.name}
                      {!earned && (
                        <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {t('dashboard.overview.achievements.locked')}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {badgeDef.description}
                    </p>
                    <p className="text-[10px] font-medium pt-1 text-foreground/70">
                      {badgeDef.rule}
                    </p>
                    {earned && (
                      <p className="text-[10px] text-primary/80 pt-1">
                        {t('dashboard.overview.achievements.unlocked', {
                          date: formatDate(new Date(earned.unlocked_at), locale),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {reportingDeck && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-deck-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setReportingDeck(null)}
        >
          <Card
            className="w-full max-w-md shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <CardTitle
                id="report-deck-title"
                className="flex items-center gap-2"
              >
                <Flag className="size-5 text-destructive" />
                {t('dashboard.overview.community.report_deck', {
                  deck: reportingDeck.title || 'deck',
                })}
              </CardTitle>
              <CardDescription>
                {t('dashboard.overview.community.report_description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportSubmitted ? (
                <p className="text-sm">
                  {t('dashboard.overview.community.report_recorded')}
                </p>
              ) : (
                <textarea
                  aria-label="Reason for report"
                  value={reportReason}
                  maxLength={2000}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t(
                    'dashboard.overview.community.report_placeholder',
                  )}
                />
              )}
              {reportError && (
                <p role="alert" className="text-sm text-destructive">
                  {reportError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setReportingDeck(null)}
                >
                  {reportSubmitted ? t('common.close') : t('common.cancel')}
                </Button>
                {!reportSubmitted && (
                  <Button
                    disabled={
                      !reportReason.trim() || reportingIds.has(reportingDeck.id)
                    }
                    onClick={async () => {
                      const result = await reportDeck(
                        reportingDeck.id,
                        reportReason.trim(),
                      );
                      if (result) setReportSubmitted(true);
                    }}
                  >
                    {reportingIds.has(reportingDeck.id) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      t('dashboard.overview.community.submit_report')
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none"
      >
        {notifications.map((code) => (
          <div
            key={code}
            className="bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5"
          >
            <Sparkles className="size-4 shrink-0" />
            <div className="text-sm font-medium">
              {t('dashboard.overview.toasts.challenge_completed')}
              {code === 'daily-review'
                ? t('dashboard.overview.goals.daily_review')
                : t('dashboard.overview.goals.new_vocabulary')}
            </div>
          </div>
        ))}

        {badgeNotifications.map((badgeId) => {
          const badgeDef = getBadges(t).find((b) => b.id === badgeId);
          if (!badgeDef) return null;
          const Icon = badgeDef.icon;
          return (
            <div
              key={badgeId}
              role="status"
              className="bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5"
            >
              <span className="sr-only">Badge unlocked: {badgeDef.name}</span>
              <div
                className="bg-primary-foreground/20 p-2 rounded-full shrink-0"
                aria-hidden="true"
              >
                <Icon className="size-5" />
              </div>
              <div aria-hidden="true">
                <div className="text-sm font-bold flex items-center gap-1.5">
                  <Trophy className="size-3.5 text-yellow-300" />
                  {t('dashboard.overview.toasts.new_badge')}
                </div>
                <div className="text-xs text-primary-foreground/90 mt-0.5 font-medium">
                  {badgeDef.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
