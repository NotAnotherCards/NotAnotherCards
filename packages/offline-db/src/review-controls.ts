import type { ReviewRating } from './review-scheduler.js';

export type ReviewAnswer = 'forgot' | 'hard' | 'remember' | 'very-easy';

export const reviewAnswerLabels: Readonly<Record<ReviewAnswer, string>> = {
  forgot: 'Forgot',
  hard: 'Struggled',
  remember: 'Remembered',
  'very-easy': 'Knew it',
};

export const extendedReviewAnswerLabels: Readonly<
  Record<ReviewAnswer, string>
> = {
  forgot: 'Again',
  hard: 'Hard',
  remember: 'Good',
  'very-easy': 'Easy',
};

export const reviewRatingByAnswer: Readonly<
  Record<ReviewAnswer, ReviewRating>
> = {
  forgot: 1,
  hard: 2,
  remember: 3,
  'very-easy': 4,
};

export function formatReviewInterval(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  const days = Math.round(minutes / (24 * 60));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
