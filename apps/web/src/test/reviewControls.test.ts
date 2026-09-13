import { describe, expect, it } from 'vitest';
import {
  extendedReviewAnswerLabels,
  formatReviewInterval,
  getAnswerForReviewGesture,
  reviewAnswerLabels,
} from '@/components/review/review-controls';

describe('review controls', () => {
  it('uses the agreed visible labels for all answer variants', () => {
    expect(reviewAnswerLabels).toEqual({
      forgot: 'Forgot',
      hard: 'Struggled',
      remember: 'Remembered',
      'very-easy': 'Knew it',
    });
  });

  it('uses the shorter labels only for extended answer buttons', () => {
    expect(extendedReviewAnswerLabels).toEqual({
      forgot: 'Again',
      hard: 'Hard',
      remember: 'Good',
      'very-easy': 'Easy',
    });
  });

  it('formats short review intervals in minutes or hours', () => {
    expect(formatReviewInterval(5)).toBe('5 min');
    expect(formatReviewInterval(120)).toBe('2 hours');
    expect(formatReviewInterval(24 * 60)).toBe('1 day');
  });

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
