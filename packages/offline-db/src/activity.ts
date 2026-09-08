/**
 * Shared activity and gamification rules from epic #269.
 *
 * - Reviews award their rating in points (Again 1, Hard 2, Good 3, Easy 4)
 * - A review event is counted once, by id
 * - A note is learned after a successful rating (2-4) on one of its retained
 *   cards; later deactivating that card does not erase learning history, and
 *   reviewing sibling cards still learns one note
 * - A learning day has at least one review in the user's calendar day
 * - A current streak may finish today or yesterday
 * - `daily-review` needs 20 reviews in the current calendar day
 * - `new-vocabulary` needs 5 distinct notes created in that day
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
 * API results reproducible for the same records, timestamp, and timezone.
 */

import moment from 'moment-timezone';

export const REVIEW_POINTS_BY_RATING = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
} as const;

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
  readonly timeZone?: string | null;
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
  readonly timeZone: string;
  // Gregorian calendar date in the resolved timezone, formatted YYYY-MM-DD
  readonly localDate: string;
  readonly challenges: readonly DailyChallengeProgress[];
}

export interface ActivitySummary extends ReviewActivity, StreakActivity {
  readonly timeZone: string;
  readonly localDate: string;
  readonly learnedNoteCount: number;
  readonly todayChallenges: readonly DailyChallengeProgress[];
  readonly eligibleBadgeCodes: readonly BadgeCode[];
}

const MILLISECONDS_PER_DAY = 86_400_000;
const UTC = 'UTC';

interface LocalDay {
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
  if (!(event.rating in REVIEW_POINTS_BY_RATING)) {
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

// Moment Timezone carries the IANA data, so resolving and converting calendar
// dates does not depend on a runtime's partial or platform-specific Intl build
export function resolveActivityTimeZone(timeZone?: string | null): string {
  return timeZone && moment.tz.zone(timeZone) ? timeZone : UTC;
}

function localDayAt(timestamp: number, timeZone: string): LocalDay {
  const local = moment.tz(timestamp, timeZone);
  const year = local.year();
  const month = local.month() + 1;
  const day = local.date();

  return {
    key: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    // Calendar ordinals, rather than elapsed 24-hour periods, make adjacent
    // local dates consecutive across daylight-saving changes
    ordinal: Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY),
  };
}

function reviewActivityFromUniqueEvents(
  reviewEvents: readonly ActivityReviewEvent[],
): ReviewActivity {
  let reviewPoints = 0;
  let reviewPointsReachedAt: number | null = null;

  for (const event of reviewEvents) {
    reviewPoints +=
      REVIEW_POINTS_BY_RATING[
        event.rating as keyof typeof REVIEW_POINTS_BY_RATING
      ];
    reviewPointsReachedAt = Math.max(
      reviewPointsReachedAt ?? event.reviewed_at,
      event.reviewed_at,
    );
  }

  return {
    reviewPoints,
    reviewCount: reviewEvents.length,
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
  timeZone: string,
): StreakActivity {
  const todayOrdinal = localDayAt(now, timeZone).ordinal;
  const learningDayOrdinals = [
    ...new Set(
      reviewEvents
        .map((event) => localDayAt(event.reviewed_at, timeZone).ordinal)
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
  timeZone?: string | null,
): StreakActivity {
  assertTimestamp(now, 'Now');
  const resolvedTimeZone = resolveActivityTimeZone(timeZone);
  return streaksFromUniqueEvents(
    uniqueReviewEvents(reviewEvents),
    now,
    resolvedTimeZone,
  );
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
  timeZone: string,
): TodayChallengeActivity {
  const today = localDayAt(now, timeZone);
  const reviewCount = reviewEvents.filter(
    (event) => localDayAt(event.reviewed_at, timeZone).key === today.key,
  ).length;
  const newNoteCount = uniqueById(notes).filter((note) => {
    assertTimestamp(note.created_at, 'Note creation timestamp');
    return localDayAt(note.created_at, timeZone).key === today.key;
  }).length;

  return {
    timeZone,
    localDate: today.key,
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
  timeZone?: string | null,
): TodayChallengeActivity {
  assertTimestamp(now, 'Now');
  const resolvedTimeZone = resolveActivityTimeZone(timeZone);
  return todayChallengeActivityFromUniqueRecords(
    uniqueReviewEvents(reviewEvents),
    notes,
    now,
    resolvedTimeZone,
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
  const timeZone = resolveActivityTimeZone(input.timeZone);
  const reviewEvents = uniqueReviewEvents(input.reviewEvents);
  const reviewActivity = reviewActivityFromUniqueEvents(reviewEvents);
  const streakActivity = streaksFromUniqueEvents(
    reviewEvents,
    input.now,
    timeZone,
  );
  const today = todayChallengeActivityFromUniqueRecords(
    reviewEvents,
    input.notes,
    input.now,
    timeZone,
  );

  return {
    ...reviewActivity,
    ...streakActivity,
    timeZone,
    localDate: today.localDate,
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
