// How a swipe on the review card becomes an answer, the same on web and
// mobile. Only the rules live here: each client tracks the pointer or touch
// and animates the card itself.

export type ReviewMode = 'two' | 'three' | 'four';
export type ReviewGesture = 'left' | 'right' | 'up';
// The answers a gesture can give. Very easy has no gesture, so a swipe
// never claims more certainty than a quick flick can carry.
export type ReviewGestureAnswer = 'forgot' | 'hard' | 'remember';
export type ReviewSwipeDirection = ReviewGestureAnswer | 'delete';

const answersByGesture: Record<
  ReviewMode,
  Partial<Record<ReviewGesture, ReviewGestureAnswer>>
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
): ReviewGestureAnswer | null {
  return answersByGesture[mode][gesture] ?? null;
}

// A drag of dx, dy (screen coordinates, y grows downwards) becomes a
// direction once its longer side reaches the threshold. Horizontal wins a
// tie; down deletes, and asks first on every client.
//
// With diagonalEasy, a swipe down and to the right, between 30 and 60
// degrees below horizontal, answers very easy, in four-answer mode only:
// towards the Easy button, at the bottom right. Flatter stays remember,
// steeper stays delete. A client opts in by passing it (mobile does; web
// does not yet), and only then can the result be very easy.
export function getSwipeDirection(
  mode: ReviewMode,
  dx: number,
  dy: number,
  threshold: number,
): ReviewSwipeDirection | null;
export function getSwipeDirection(
  mode: ReviewMode,
  dx: number,
  dy: number,
  threshold: number,
  diagonalEasy: boolean,
): ReviewSwipeDirection | 'very-easy' | null;
export function getSwipeDirection(
  mode: ReviewMode,
  dx: number,
  dy: number,
  threshold: number,
  diagonalEasy = false,
): ReviewSwipeDirection | 'very-easy' | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (diagonalEasy && mode === 'four' && dx > 0 && dy > 0) {
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (degrees < 30) return 'remember';
    if (degrees <= 60) return 'very-easy';
    return 'delete';
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return getAnswerForReviewGesture(mode, dx > 0 ? 'right' : 'left');
  }
  return dy < 0 ? getAnswerForReviewGesture(mode, 'up') : 'delete';
}
