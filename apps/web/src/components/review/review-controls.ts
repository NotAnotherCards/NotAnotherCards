export type ReviewAnswer = 'forgot' | 'hard' | 'remember' | 'very-easy';
export type ReviewMode = 'two' | 'three' | 'four';
export type ReviewGesture = 'left' | 'right' | 'up';

export const reviewAnswerLabels: Record<ReviewAnswer, string> = {
  forgot: 'Forgot',
  hard: 'Struggled',
  remember: 'Remembered',
  'very-easy': 'Knew it',
};

export const extendedReviewAnswerLabels: Record<ReviewAnswer, string> = {
  forgot: 'Again',
  hard: 'Hard',
  remember: 'Good',
  'very-easy': 'Easy',
};

export function formatReviewInterval(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  const days = Math.round(minutes / (24 * 60));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

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

export function getAnswerForReviewGesture(
  mode: ReviewMode,
  gesture: ReviewGesture,
) {
  return answersByGesture[mode][gesture] ?? null;
}
