import type { ReviewAnswer } from '@repo/offline-db';
import type { ReviewMode } from '@repo/study';

export {
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  type ReviewAnswer,
} from '@repo/offline-db';

// The swipe rules are shared with mobile; the keyboard stays web's own.
export {
  getAnswerForReviewGesture,
  type ReviewGesture,
  type ReviewMode,
} from '@repo/study';

export const CURRENT_REVIEW_MODE: ReviewMode = 'four';

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

export function getAnswerForReviewKeyboardShortcut(
  mode: ReviewMode,
  key: string,
) {
  return answersByKeyboardShortcut[mode][key] ?? null;
}
