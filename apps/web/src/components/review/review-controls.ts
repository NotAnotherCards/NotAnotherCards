import {
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  type ReviewAnswer,
} from '@repo/offline-db';

export {
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  type ReviewAnswer,
};
export type ReviewMode = 'two' | 'three' | 'four';
export type ReviewGesture = 'left' | 'right' | 'up';

type GestureReviewAnswer = Exclude<ReviewAnswer, 'very-easy'>;

export const CURRENT_REVIEW_MODE: ReviewMode = 'four';

const answersByGesture: Record<
  ReviewMode,
  Partial<Record<ReviewGesture, GestureReviewAnswer>>
> = {
  two: {
    left: 'forgot',
    right: 'remember',
  },
  three: {
    left: 'forgot',
    right: 'remember',
    up: 'hard',
  },
  four: {
    left: 'forgot',
    right: 'remember',
    up: 'hard',
  },
};

const answersByKeyboardShortcut: Record<
  ReviewMode,
  Partial<Record<string, ReviewAnswer>>
> = {
  two: {
    1: 'forgot',
    2: 'remember',
  },
  three: {
    1: 'forgot',
    2: 'hard',
    3: 'remember',
  },
  four: {
    1: 'forgot',
    2: 'hard',
    3: 'remember',
    4: 'very-easy',
  },
};

export function getAnswerForReviewGesture(
  mode: ReviewMode,
  gesture: ReviewGesture,
) {
  return answersByGesture[mode][gesture] ?? null;
}

export function getAnswerForReviewKeyboardShortcut(
  mode: ReviewMode,
  key: string,
) {
  return answersByKeyboardShortcut[mode][key] ?? null;
}
