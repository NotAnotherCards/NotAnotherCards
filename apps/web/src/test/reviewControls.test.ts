import { describe, expect, it } from 'vitest';
import { getAnswerForReviewGesture } from '@/components/review/review-controls';

describe('review controls', () => {
  it('keeps the Up gesture inactive in the two-answer mode', () => {
    expect(getAnswerForReviewGesture('two', 'left')).toBe('forgot');
    expect(getAnswerForReviewGesture('two', 'right')).toBe('remember');
    expect(getAnswerForReviewGesture('two', 'up')).toBeNull();
  });

  it.each(['three', 'four'] as const)(
    'maps Left, Up, and Right in the %s-answer mode',
    (mode) => {
      expect(getAnswerForReviewGesture(mode, 'left')).toBe('forgot');
      expect(getAnswerForReviewGesture(mode, 'up')).toBe('hard');
      expect(getAnswerForReviewGesture(mode, 'right')).toBe('remember');
    },
  );
});
