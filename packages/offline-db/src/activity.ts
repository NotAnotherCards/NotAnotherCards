/**
 * Shared activity and gamification rules from epic #269.
 *
 * - Every review awards one point, regardless of rating
 * - A review event is counted once, by id
 * - Learned-note analytics remain separate from points: a note is learned
 *   after a successful rating (2-4) on one of its retained cards; later
 *   deactivating that card does not erase learning history, and reviewing
 *   sibling cards still learns one note
 * - A learning day has at least one review on its UTC calendar date
 * - A current streak may finish on the current or preceding UTC date
 * - `daily-review` needs 20 reviews on the current UTC date
 * - `new-vocabulary` needs 5 distinct notes created on that UTC date
 * - The initial badges are earned by the first review, a seven-day streak,
 *   and one hundred reviews
 * - The global leaderboard uses all-time review points. Ties sort by the
 *   earliest time the score was reached, then public username; emails never
 *   belong in its result
 * - Persisted awards use stable badge/challenge codes and timestamps. Display
 *   names and descriptions remain client-side translation keys
 *
 * These selectors deliberately accept plain records and have no database or
 * UI dependencies. Callers must pass `now`; this keeps browser, mobile, and
 * API results reproducible for the same records and timestamp. User-local
 * calendar days and daylight-saving behavior are deferred.
 */

export const SUCCESSFUL_REVIEW_RATING_MIN = 2;

export const DAILY_CHALLENGE_CODES = [
  'daily-review',
  'new-vocabulary',
] as const;

export type DailyChallengeCode = (typeof DAILY_CHALLENGE_CODES)[number];

export const DAILY_CHALLENGE_TARGETS = {
  'daily-review': 20,
  'new-vocabulary': 5,
} as const satisfies Readonly<Record<DailyChallengeCode, number>>;

export const BADGE_CODES = [
  'first-review',
  'seven-day-streak',
  'hundred-reviews',
] as const;

export type BadgeCode = (typeof BADGE_CODES)[number];

export const BADGE_TARGETS = {
  'first-review': { metric: 'review-count', target: 1 },
  'seven-day-streak': { metric: 'longest-streak', target: 7 },
  'hundred-reviews': { metric: 'review-count', target: 100 },
} as const satisfies Readonly<
  Record<
    BadgeCode,
    {
      readonly metric: 'review-count' | 'longest-streak';
      readonly target: number;
    }
  >
>;

export interface ActivityReviewEvent {
  readonly id: string;
  readonly user_card_id: string;
  readonly rating: number;
  readonly reviewed_at: number;
}

export interface ActivityCard {
  readonly id: string;
  readonly note_id: string;
  // Current presentation state; historical learning does not depend on it
  readonly active?: boolean;
}

export interface ActivityNote {
  readonly id: string;
  readonly created_at: number;
}

export interface ActivitySelectorInput {
  readonly reviewEvents: readonly ActivityReviewEvent[];
  readonly cards: readonly ActivityCard[];
  readonly notes: readonly ActivityNote[];
  readonly now: number;
}

export interface ReviewActivity {
  readonly reviewPoints: number;
  readonly reviewCount: number;
  // The time the current all-time score was reached; useful for tie breaks
  readonly reviewPointsReachedAt: number | null;
}

export interface StreakActivity {
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface DailyChallengeProgress {
  readonly code: DailyChallengeCode;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
}

export interface TodayChallengeActivity {
  // UTC Gregorian calendar date, formatted YYYY-MM-DD
  readonly utcDate: string;
  readonly challenges: readonly DailyChallengeProgress[];
}

export interface ActivitySummary extends ReviewActivity, StreakActivity {
  readonly utcDate: string;
  readonly learnedNoteCount: number;
  readonly todayChallenges: readonly DailyChallengeProgress[];
  readonly eligibleBadgeCodes: readonly BadgeCode[];
}

const MILLISECONDS_PER_DAY = 86_400_000;

interface UtcDay {
  readonly key: string;
  readonly ordinal: number;
}

function assertTimestamp(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer timestamp`);
  }
  if (Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${field} is outside the supported date range`);
  }
}

function assertReviewEvent(event: ActivityReviewEvent): void {
  if (!event.id) throw new Error('Review event id must not be empty');
  if (!event.user_card_id) {
    throw new Error('Review event user_card_id must not be empty');
  }
  if (!Number.isInteger(event.rating) || event.rating < 1 || event.rating > 4) {
    throw new Error(`Unsupported review rating: ${event.rating}`);
  }
  assertTimestamp(event.reviewed_at, 'Review timestamp');
}

function uniqueById<T extends { readonly id: string }>(
  records: readonly T[],
): T[] {
  const unique = new Map<string, T>();
  for (const record of records) {
    if (!record.id) throw new Error('Activity record id must not be empty');
    if (!unique.has(record.id)) unique.set(record.id, record);
  }
  return [...unique.values()];
}

function uniqueReviewEvents(
  reviewEvents: readonly ActivityReviewEvent[],
): ActivityReviewEvent[] {
  for (const event of reviewEvents) assertReviewEvent(event);
  return uniqueById(reviewEvents);
}

function utcDayAt(timestamp: number): UtcDay {
  return {
    key: new Date(timestamp).toISOString().slice(0, 10),
    ordinal: Math.floor(timestamp / MILLISECONDS_PER_DAY),
  };
}

function reviewActivityFromUniqueEvents(
  reviewEvents: readonly ActivityReviewEvent[],
): ReviewActivity {
  let reviewPointsReachedAt: number | null = null;

  for (const event of reviewEvents) {
    reviewPointsReachedAt = Math.max(
      reviewPointsReachedAt ?? event.reviewed_at,
      event.reviewed_at,
    );
  }

  const reviewCount = reviewEvents.length;

  return {
    reviewPoints: reviewCount,
    reviewCount,
    reviewPointsReachedAt,
  };
}

export function selectReviewActivity(
  reviewEvents: readonly ActivityReviewEvent[],
): ReviewActivity {
  return reviewActivityFromUniqueEvents(uniqueReviewEvents(reviewEvents));
}

function learnedNoteCountFromUniqueRecords(
  reviewEvents: readonly ActivityReviewEvent[],
  cards: readonly ActivityCard[],
  notes: readonly ActivityNote[],
): number {
  const existingNoteIds = new Set(uniqueById(notes).map((note) => note.id));
  const cardNoteIds = new Map(
    uniqueById(cards)
      .filter((card) => existingNoteIds.has(card.note_id))
      .map((card) => [card.id, card.note_id]),
  );
  const learnedNoteIds = new Set<string>();

  for (const event of reviewEvents) {
    if (event.rating < SUCCESSFUL_REVIEW_RATING_MIN) continue;
    const noteId = cardNoteIds.get(event.user_card_id);
    if (noteId) learnedNoteIds.add(noteId);
  }

  return learnedNoteIds.size;
}

export function selectLearnedNoteCount(
  reviewEvents: readonly ActivityReviewEvent[],
  cards: readonly ActivityCard[],
  notes: readonly ActivityNote[],
): number {
  return learnedNoteCountFromUniqueRecords(
    uniqueReviewEvents(reviewEvents),
    cards,
    notes,
  );
}

function streaksFromUniqueEvents(
  reviewEvents: readonly ActivityReviewEvent[],
  now: number,
): StreakActivity {
  const todayOrdinal = utcDayAt(now).ordinal;
  const learningDayOrdinals = [
    ...new Set(
      reviewEvents
        .map((event) => utcDayAt(event.reviewed_at).ordinal)
        .filter((ordinal) => ordinal <= todayOrdinal),
    ),
  ].sort((left, right) => left - right);

  let longestStreak = 0;
  let run = 0;
  let previous: number | undefined;
  for (const ordinal of learningDayOrdinals) {
    run = previous !== undefined && ordinal === previous + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = ordinal;
  }

  const latest = learningDayOrdinals[learningDayOrdinals.length - 1];
  if (latest === undefined || todayOrdinal - latest > 1) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  for (let index = learningDayOrdinals.length - 2; index >= 0; index -= 1) {
    if (learningDayOrdinals[index] !== latest - currentStreak) break;
    currentStreak += 1;
  }

  return { currentStreak, longestStreak };
}

export function selectStreakActivity(
  reviewEvents: readonly ActivityReviewEvent[],
  now: number,
): StreakActivity {
  assertTimestamp(now, 'Now');
  return streaksFromUniqueEvents(uniqueReviewEvents(reviewEvents), now);
}

function challenge(
  code: DailyChallengeCode,
  current: number,
): DailyChallengeProgress {
  const target = DAILY_CHALLENGE_TARGETS[code];
  return { code, current, target, completed: current >= target };
}

function todayChallengeActivityFromUniqueRecords(
  reviewEvents: readonly ActivityReviewEvent[],
  notes: readonly ActivityNote[],
  now: number,
): TodayChallengeActivity {
  const today = utcDayAt(now);
  const reviewCount = reviewEvents.filter(
    (event) => utcDayAt(event.reviewed_at).key === today.key,
  ).length;
  const newNoteCount = uniqueById(notes).filter((note) => {
    assertTimestamp(note.created_at, 'Note creation timestamp');
    return utcDayAt(note.created_at).key === today.key;
  }).length;

  return {
    utcDate: today.key,
    challenges: [
      challenge('daily-review', reviewCount),
      challenge('new-vocabulary', newNoteCount),
    ],
  };
}

export function selectTodayChallengeActivity(
  reviewEvents: readonly ActivityReviewEvent[],
  notes: readonly ActivityNote[],
  now: number,
): TodayChallengeActivity {
  assertTimestamp(now, 'Now');
  return todayChallengeActivityFromUniqueRecords(
    uniqueReviewEvents(reviewEvents),
    notes,
    now,
  );
}

export function selectEligibleBadgeCodes(
  activity: Pick<ReviewActivity, 'reviewCount'> &
    Pick<StreakActivity, 'longestStreak'>,
): BadgeCode[] {
  return BADGE_CODES.filter((code) => {
    const requirement = BADGE_TARGETS[code];
    const value =
      requirement.metric === 'review-count'
        ? activity.reviewCount
        : activity.longestStreak;
    return value >= requirement.target;
  });
}

export function selectActivitySummary(
  input: ActivitySelectorInput,
): ActivitySummary {
  assertTimestamp(input.now, 'Now');
  const reviewEvents = uniqueReviewEvents(input.reviewEvents);
  const reviewActivity = reviewActivityFromUniqueEvents(reviewEvents);
  const streakActivity = streaksFromUniqueEvents(reviewEvents, input.now);
  const today = todayChallengeActivityFromUniqueRecords(
    reviewEvents,
    input.notes,
    input.now,
  );

  return {
    ...reviewActivity,
    ...streakActivity,
    utcDate: today.utcDate,
    learnedNoteCount: learnedNoteCountFromUniqueRecords(
      reviewEvents,
      input.cards,
      input.notes,
    ),
    todayChallenges: today.challenges,
    eligibleBadgeCodes: selectEligibleBadgeCodes({
      reviewCount: reviewActivity.reviewCount,
      longestStreak: streakActivity.longestStreak,
    }),
  };
}
