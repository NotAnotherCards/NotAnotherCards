import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import {
  getNotesQuery,
  getPersonalDictionaryQuery,
  getReviewHistoryQuery,
  type ReviewEventRecord,
  type UserCardRecord,
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
): DailyGoal[] {
  return challenges.map((challenge) => {
    const isReview = challenge.code === 'daily-review';
    return {
      code: challenge.code,
      title: isReview ? 'Daily Review' : 'New Vocabulary',
      description: isReview
        ? `Review at least ${challenge.target} words due today`
        : `Add ${challenge.target} new words to your personal dictionary`,
      progress: `${challenge.current} / ${challenge.target}`,
      percent: Math.min(
        100,
        Math.round((challenge.current / challenge.target) * 100),
      ),
      completed: challenge.completed,
      reward: challenge.completed
        ? 'Completed'
        : `${Math.max(0, challenge.target - challenge.current)} remaining`,
    };
  });
}

export function overviewStats(
  reviewEvents: readonly ActivityReviewEvent[],
  cards: readonly ActivityCard[],
  notes: readonly ActivityNote[],
  now: number,
): OverviewStats {
  return {
    dictionarySize: cards.length,
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

  // Computed on every render, not memoized: the streak depends on the day,
  // and a memo keyed on the data would keep yesterday's until the next
  // review. The selectors throw on a malformed review event instead of
  // counting it; report that like a failed query rather than crash.
  let stats: OverviewStats | null = null;
  let selectorError: Error | null = null;
  try {
    stats = overviewStats(
      reviewEvents.data,
      cards.data,
      notes.data,
      Date.now(),
    );
  } catch (error) {
    selectorError = error instanceof Error ? error : new Error(String(error));
  }

  return {
    stats,
    isLoading:
      !db || reviewEvents.isLoading || cards.isLoading || notes.isLoading,
    error: reviewEvents.error ?? cards.error ?? notes.error ?? selectorError,
  };
}
