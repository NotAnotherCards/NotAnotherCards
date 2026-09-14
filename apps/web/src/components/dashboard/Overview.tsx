import { useState, useEffect, useRef, useMemo } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSharedDecks } from '@/hooks/useSharedDecks';
import { useImportDeck } from '@/hooks/useImportDeck';
import { useReportDeck } from '@/hooks/useReportDeck';
import { useStore } from '@/hooks/useStore';
import { useSyncController, useSyncState } from '@/offline/syncProvider';
import { useNavigate } from '@tanstack/react-router';
import {
  clearLastReviewDeckId,
  getLastReviewDeckId,
} from '@/lib/review-preferences';
import type { SharedDeckSummary } from '@repo/schemas';
import {
  selectTodayChallengeActivity,
  type DailyChallengeProgress,
} from '@repo/offline-db/activity';

type OverviewProps = {
  onChooseDeck: () => void;
};

function DashboardSyncStatus() {
  const controller = useSyncController();
  const state = useSyncState();

  if (!controller) {
    return <span className="text-muted-foreground font-semibold">Offline</span>;
  }

  const LABELS: Record<string, string> = {
    idle: 'Synced',
    syncing: 'Syncing…',
    offline: 'Offline',
    error: 'Sync failed',
    'resync-required': 'Reset required',
  };

  const statusColor =
    state.status === 'idle'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : state.status === 'syncing'
        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse'
        : state.status === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400';

  return (
    <div className="flex items-center gap-1.5 font-semibold">
      <span className={`px-2 py-0.5 rounded-full ${statusColor}`}>
        {LABELS[state.status] ?? state.status}
      </span>
      {(state.status === 'error' || state.status === 'offline') && (
        <button
          type="button"
          onClick={() => controller.syncNow()}
          className="flex items-center gap-1 underline text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-normal"
        >
          <RefreshCw className="size-3" />
          Retry
        </button>
      )}
    </div>
  );
}

export function Overview({ onChooseDeck }: OverviewProps) {
  const store = useStore();
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
    const lastDeckStillExists = store.decks.some(
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
      title: "Today's Reviews",
      value: `${store.dueCards.length} cards`,
      description: 'Due for review',
      icon: Clock,
      color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      title: 'Personal Dictionary',
      value: `${store.cards.length} cards`,
      description: 'Added to your collection',
      icon: BookMarked,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      title: 'Learning Streak',
      value: '7 Days',
      description: 'Daily learning-day streak',
      icon: Flame,
      color: 'text-orange-500 bg-orange-500/10',
    },
    {
      title: 'Words Learned',
      value: '1,240 / 10,000',
      description: '12.4% total progress',
      icon: GraduationCap,
      color: 'text-purple-500 bg-purple-500/10',
    },
  ];

  const [serverProgress, setServerProgress] = useState<
    DailyChallengeProgress[] | null
  >(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const notifiedChallenges = useRef<Set<string>>(new Set());

  // Derive immediate progress locally
  const localActivity = useMemo(() => {
    return selectTodayChallengeActivity(
      store.reviewEvents ?? [],
      store.notes ?? [],
      Date.now(),
    );
  }, [store.reviewEvents, store.notes]);

  // Reconcile with server
  useEffect(() => {
    async function fetchGamification() {
      try {
        const res = await fetch('/api/gamification/me');
        if (res.ok) {
          const data = (await res.json()) as {
            todayChallenges?: DailyChallengeProgress[];
          };
          if (data && data.todayChallenges) {
            setServerProgress(data.todayChallenges);
          }
        }
      } catch {
        // Silently fallback to local progress
      }
    }
    void fetchGamification();
  }, []);

  // Merge server and local progress
  const challenges = useMemo(() => {
    const merged = [...(localActivity.challenges || [])];
    if (serverProgress) {
      for (let i = 0; i < merged.length; i++) {
        const serverMatch = serverProgress.find(
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const newCompletions: string[] = [];
    challenges.forEach((challenge) => {
      if (
        challenge.completed &&
        !notifiedChallenges.current.has(challenge.code)
      ) {
        notifiedChallenges.current.add(challenge.code);
        newCompletions.push(challenge.code);
      }
    });

    if (newCompletions.length > 0) {
      setNotifications((prev) => [...prev, ...newCompletions]);

      timer = setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => !newCompletions.includes(n)),
        );
      }, 5000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [challenges]);

  // Map to dailyGoals format
  const dailyGoals = challenges.map((challenge, index) => {
    const isReview = challenge.code === 'daily-review';
    return {
      id: index + 1,
      title: isReview ? 'Daily Review' : 'New Vocabulary',
      description: isReview
        ? 'Review at least 20 words due today'
        : 'Add 5 new words to your personal dictionary',
      progress: `${challenge.current} / ${challenge.target}`,
      percent: Math.min(
        100,
        Math.round((challenge.current / challenge.target) * 100),
      ),
      reward: challenge.completed
        ? 'Completed'
        : `${Math.max(0, challenge.target - challenge.current)} remaining`,
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
              <span className="text-muted-foreground">Status</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
                  isOnline
                    ? 'bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive animate-pulse'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/30 text-xs">
              <span className="text-muted-foreground">Sync</span>
              <DashboardSyncStatus />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 cursor-pointer gap-1.5"
                size="sm"
                onClick={handleStartReview}
              >
                <Library className="size-3.5" />
                Start Review
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
              Community Decks
            </CardTitle>
            <CardDescription>
              Browse and study ready-made vocabulary sets shared by the
              community.
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
                  Failed to load community decks. Please try again later.
                </div>
              ) : sharedDecks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No community decks available yet.
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground">
                      <th className="px-6 py-3">Deck Name</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Cards</th>
                      <th className="px-6 py-3 text-right">Action</th>
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
                              {deck.title || 'Untitled'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal truncate">
                              by @{deck.owner.username}
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
                                'Import'
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
              Daily Learning Goals
            </CardTitle>
            <CardDescription>
              Complete daily tasks to unlock achievements and progress your
              fluency.
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
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${quest.percent}%` }}
                  />
                </div>
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
              <p>One review earns one point regardless of rating.</p>
              <p>Daily challenges and streaks reset at 00:00 UTC.</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                Report {reportingDeck.title || 'deck'}
              </CardTitle>
              <CardDescription>
                Tell the moderation team what is wrong. A report may queue a
                thorough automatic re-check, but the report alone never hides
                the deck.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportSubmitted ? (
                <p className="text-sm">Thank you. Your report was recorded.</p>
              ) : (
                <textarea
                  aria-label="Reason for report"
                  value={reportReason}
                  maxLength={2000}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe the problem with this deck"
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
                  {reportSubmitted ? 'Close' : 'Cancel'}
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
                      'Submit report'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {notifications.map((code) => (
          <div
            key={code}
            className="bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5"
          >
            <Sparkles className="size-4" />
            <div className="text-sm font-medium">
              Challenge Completed:{' '}
              {code === 'daily-review' ? 'Daily Review' : 'New Vocabulary'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
