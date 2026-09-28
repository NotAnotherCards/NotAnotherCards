import type { ReviewAnswer } from '@repo/offline-db';

// One hue per answer, the dark: border too because outline sets its own.
export const answerColours: Record<
  ReviewAnswer,
  { button: string; text: string }
> = {
  forgot: {
    button: 'border-rating-again/40 dark:border-rating-again/40',
    text: 'text-rating-again',
  },
  hard: {
    button: 'border-rating-hard/40 dark:border-rating-hard/40',
    text: 'text-rating-hard',
  },
  remember: {
    button: 'border-rating-good/40 dark:border-rating-good/40',
    text: 'text-rating-good',
  },
  'very-easy': {
    button: 'border-rating-easy/40 dark:border-rating-easy/40',
    text: 'text-rating-easy',
  },
};
