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
  type ActivityCard,
  type ActivityNote,
  type ActivityReviewEvent,
} from '@repo/offline-db/activity';

// Web's Overview tiles, less "Today's Reviews": that one is the due count,
// which the review overview above the tiles already shows.
export interface OverviewStats {
  dictionarySize: number;
  streak: number;
  wordsLearned: number;
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
