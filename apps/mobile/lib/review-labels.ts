import type { TFunction } from 'i18next';
import type { ReviewAnswer } from '@repo/offline-db';

const answerKeys = {
  forgot: 'review.answers.forgot',
  hard: 'review.answers.hard',
  remember: 'review.answers.remember',
  'very-easy': 'review.answers.very_easy',
} as const;
const basicKeys = {
  forgot: 'review.swipe.forgot_basic',
  hard: 'review.swipe.hard_basic',
  remember: 'review.swipe.remember_basic',
  'very-easy': 'review.answers.very_easy',
} as const;

export const reviewAnswerLabel = (
  t: TFunction,
  answer: ReviewAnswer,
  extended: boolean,
) => t((extended ? answerKeys : basicKeys)[answer]);

export function reviewIntervalLabel(minutes: number, t: TFunction) {
  const unit = minutes < 60 ? 'minute' : minutes < 1440 ? 'hour' : 'day';
  const value =
    unit === 'minute'
      ? minutes
      : Math.round(minutes / (unit === 'hour' ? 60 : 1440));
  return t(`review.intervals.${unit}`, { count: value });
}
