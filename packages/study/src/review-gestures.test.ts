import { describe, expect, it } from 'vitest';
import { getAnswerForReviewGesture, getSwipeDirection } from './index.js';

describe('review gestures', () => {
  it('maps left and right in every mode, up only with three or four answers', () => {
    expect(getAnswerForReviewGesture('two', 'left')).toBe('forgot');
    expect(getAnswerForReviewGesture('two', 'right')).toBe('remember');
    expect(getAnswerForReviewGesture('two', 'up')).toBeNull();
    expect(getAnswerForReviewGesture('three', 'up')).toBe('hard');
    expect(getAnswerForReviewGesture('four', 'up')).toBe('hard');
  });

  it('turns a drag into a direction once it reaches the threshold', () => {
    expect(getSwipeDirection('four', 47, 0, 48)).toBeNull();
    expect(getSwipeDirection('four', 48, 0, 48)).toBe('remember');
    expect(getSwipeDirection('four', -60, 10, 48)).toBe('forgot');
    expect(getSwipeDirection('four', 10, -60, 48)).toBe('hard');
    expect(getSwipeDirection('four', 10, 60, 48)).toBe('delete');
  });

  it('lets horizontal win a tie and gives no answer for up in two-answer mode', () => {
    expect(getSwipeDirection('four', 50, -50, 48)).toBe('remember');
    expect(getSwipeDirection('two', 0, -60, 48)).toBeNull();
    expect(getSwipeDirection('two', 0, 60, 48)).toBe('delete');
  });
});
