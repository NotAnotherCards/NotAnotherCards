import type { DatabaseManager } from '@remelondb/core';
import type { TFunction } from 'i18next';
import { useDatabase, useQuery } from '@remelondb/core/react';
import { useNow } from './use-now';
import {
  getNoteDecksQuery,
  getNotesQuery,
  getPersonalDictionaryQuery,
  getReviewHistoryQuery,
  type ReviewEventRecord,
  type UserCardRecord,
  type UserNoteDeckRecord,
  type UserNoteRecord,
} from '@repo/offline-db';
import {
  selectLearnedNoteCount,
  selectStreakActivity,
  selectTodayChallengeActivity,
  type ActivityCard,
  type ActivityNote,
  type ActivityReviewEvent,
  type DailyChallengeProgress,
} from '@repo/offline-db/activity';

// Web's Overview tiles, less "Today's Reviews": that one is the due count,
// which the review overview above the tiles already shows. Plus today's
// daily challenges, counted locally only: web also asks the server, but
// review events sync between devices, and the phone must work offline.
export interface OverviewStats {
  dictionarySize: number;
  streak: number;
  wordsLearned: number;
  challenges: readonly DailyChallengeProgress[];
}

// Web's copy for each challenge (Overview's dailyGoals).
export interface DailyGoal {
  code: DailyChallengeProgress['code'];
  title: string;
  description: string;
  progress: string;
  percent: number;
  completed: boolean;
  reward: string;
}

export function dailyGoals(
  challenges: readonly DailyChallengeProgress[],
  t: TFunction,
): DailyGoal[] {
  return challenges.map((challenge) => {
    const isReview = challenge.code === 'daily-review';
    return {
      code: challenge.code,
      title: t(
        isReview
          ? 'dashboard.overview.goals.daily_review'
          : 'dashboard.overview.goals.new_vocabulary',
      ),
      description: isReview
        ? t('mobile.review_goal', { count: challenge.target })
        : t('mobile.vocabulary_goal', { count: challenge.target }),
      progress: `${challenge.current} / ${challenge.target}`,
      percent: Math.min(
        100,
        Math.round((challenge.current / challenge.target) * 100),
      ),
      completed: challenge.completed,
      reward: challenge.completed
        ? t('dashboard.overview.goals.completed')
        : t('dashboard.overview.goals.remaining', {
            value: Math.max(0, challenge.target - challenge.current),
          }),
    };
  });
}

export function overviewStats(
  reviewEvents: readonly ActivityReviewEvent[],
  cards: readonly ActivityCard[],
  notes: readonly ActivityNote[],
  memberships: readonly { note_id: string }[],
  now: number,
): OverviewStats {
  return {
    // Web's count: the notes that are in a deck, each once, however many
    // cards it has and however many decks hold it.
    dictionarySize: new Set(memberships.map((m) => m.note_id)).size,
    streak: selectStreakActivity(reviewEvents, now).currentStreak,
    wordsLearned: selectLearnedNoteCount(reviewEvents, cards, notes),
    challenges: selectTodayChallengeActivity(reviewEvents, notes, now)
      .challenges,
  };
}

export function useOverviewStats(manager: DatabaseManager) {
  const db = useDatabase(manager);
  const reviewEvents = useQuery<ReviewEventRecord>(
    db && getReviewHistoryQuery(db),
  );
  const cards = useQuery<UserCardRecord>(db && getPersonalDictionaryQuery(db));
  const notes = useQuery<UserNoteRecord>(db && getNotesQuery(db));
  const memberships = useQuery<UserNoteDeckRecord>(db && getNoteDecksQuery(db));
  const now = useNow();

  // Recomputed on each render and at least every minute (useNow), so the
  // streak and the goals follow the UTC day. The selectors throw on a
  // malformed review event instead of counting it; report that like a
  // failed query rather than crash.
  let stats: OverviewStats | null = null;
  let selectorError: Error | null = null;
  try {
    stats = overviewStats(
      reviewEvents.data,
      cards.data,
      notes.data,
      memberships.data,
      now,
    );
  } catch (error) {
    selectorError = error instanceof Error ? error : new Error(String(error));
  }

  return {
    stats,
    isLoading:
      !db ||
      reviewEvents.isLoading ||
      cards.isLoading ||
      notes.isLoading ||
      memberships.isLoading,
    error:
      reviewEvents.error ??
      cards.error ??
      notes.error ??
      memberships.error ??
      selectorError,
  };
}
