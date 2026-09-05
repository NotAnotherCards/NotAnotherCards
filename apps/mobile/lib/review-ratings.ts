import { REVIEW_RATINGS, type ReviewRating } from '@repo/offline-db';

const MINUTES_PER_DAY = 24 * 60;

// The four ratings in the order they are shown, hardest first, matching
// web's FlashcardModal. The scale itself is the shared scheduler's.
export const RATING_LABELS: Readonly<Record<ReviewRating, string>> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

export const RATINGS = REVIEW_RATINGS;

// Same rounding as web, so a card previews the same interval on both.
export function formatReviewInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < MINUTES_PER_DAY) {
    return `${Math.round((minutes / 60) * 10) / 10}h`;
  }
  return `${Math.round((minutes / MINUTES_PER_DAY) * 10) / 10}d`;
}
