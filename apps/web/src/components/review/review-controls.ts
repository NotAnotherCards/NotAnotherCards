export type ReviewAnswer = 'forgot' | 'hard' | 'remember' | 'very-easy';
export type ReviewMode = 'two' | 'three' | 'four';
export type ReviewGesture = 'left' | 'right' | 'up';

type GestureReviewAnswer = Exclude<ReviewAnswer, 'very-easy'>;

export const CURRENT_REVIEW_MODE: ReviewMode = 'three';

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

export function getAnswerForReviewGesture(
  mode: ReviewMode,
  gesture: ReviewGesture,
) {
  return answersByGesture[mode][gesture] ?? null;
}
