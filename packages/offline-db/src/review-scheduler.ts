const MINUTES_PER_DAY = 24 * 60;
const MILLISECONDS_PER_MINUTE = 60_000;

export const REVIEW_RATINGS = [1, 2, 3, 4] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];
type MultiplicativeReviewRating = Exclude<ReviewRating, 1>;

export const FORGOT_INTERVAL_MINUTES = 5;
export const REVIEW_INTERVAL_FLOOR_MINUTES: Readonly<
  Record<ReviewRating, number>
> = {
  1: FORGOT_INTERVAL_MINUTES,
  2: MINUTES_PER_DAY,
  3: 3 * MINUTES_PER_DAY,
  4: 7 * MINUTES_PER_DAY,
};
export const REVIEW_INTERVAL_MULTIPLIERS: Readonly<
  Record<MultiplicativeReviewRating, number>
> = {
  2: 1.2,
  3: 2.5,
  4: 3.25,
};
export const REVIEW_INTERVAL_CAP_MINUTES = 120 * MINUTES_PER_DAY;

export type ReviewSchedule = {
  readonly scheduled_interval_minutes: number;
  readonly due_at: number;
};

function isReviewRating(rating: number): rating is ReviewRating {
  return REVIEW_RATINGS.some((candidate) => candidate === rating);
}

// Calculate the agreed v1 multiplicative interval in whole minutes
export function calculateReviewIntervalMinutes(
  previousIntervalMinutes: number,
  rating: number,
): number {
  if (
    !Number.isSafeInteger(previousIntervalMinutes) ||
    previousIntervalMinutes < 0
  ) {
    throw new Error('Previous review interval must be a non-negative integer');
  }
  if (!isReviewRating(rating)) {
    throw new Error(`Unsupported review rating: ${rating}`);
  }

  if (rating === 1) return FORGOT_INTERVAL_MINUTES;

  const multipliedInterval = Math.round(
    previousIntervalMinutes * REVIEW_INTERVAL_MULTIPLIERS[rating],
  );
  return Math.min(
    REVIEW_INTERVAL_CAP_MINUTES,
    Math.max(REVIEW_INTERVAL_FLOOR_MINUTES[rating], multipliedInterval),
  );
}

// Calculate both synchronized schedule fields from one review decision
export function calculateReviewSchedule(
  previousIntervalMinutes: number,
  rating: number,
  reviewedAt: number,
): ReviewSchedule {
  if (!Number.isSafeInteger(reviewedAt) || reviewedAt < 0) {
    throw new Error('Review timestamp must be a non-negative integer');
  }

  const scheduledIntervalMinutes = calculateReviewIntervalMinutes(
    previousIntervalMinutes,
    rating,
  );
  const dueAt = reviewedAt + scheduledIntervalMinutes * MILLISECONDS_PER_MINUTE;
  if (!Number.isSafeInteger(dueAt)) {
    throw new Error('Calculated due timestamp exceeds the safe integer range');
  }

  return {
    scheduled_interval_minutes: scheduledIntervalMinutes,
    due_at: dueAt,
  };
}
