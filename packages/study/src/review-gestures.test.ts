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

  // A drag of length 100 at the given angle below horizontal, to the right.
  const at = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return [100 * Math.cos(radians), 100 * Math.sin(radians)] as const;
  };

  it('answers very easy down and to the right, between 30 and 60 degrees', () => {
    expect(getSwipeDirection('four', ...at(29), 48, true)).toBe('remember');
    expect(getSwipeDirection('four', ...at(31), 48, true)).toBe('very-easy');
    expect(getSwipeDirection('four', ...at(45), 48, true)).toBe('very-easy');
    expect(getSwipeDirection('four', ...at(59), 48, true)).toBe('very-easy');
    expect(getSwipeDirection('four', ...at(61), 48, true)).toBe('delete');
    // Still a quarter's commit first, and the other directions as before.
    expect(getSwipeDirection('four', 30, 30, 48, true)).toBeNull();
    expect(getSwipeDirection('four', 150, 0, 48, true)).toBe('remember');
    expect(getSwipeDirection('four', -80, 60, 48, true)).toBe('forgot');
    expect(getSwipeDirection('four', 20, -80, 48, true)).toBe('hard');
  });

  it('gives very easy only with four answers and only when asked', () => {
    expect(getSwipeDirection('two', ...at(45), 48, true)).toBe('remember');
    expect(getSwipeDirection('two', ...at(50), 48, true)).toBe('delete');
    expect(getSwipeDirection('three', ...at(40), 48, true)).toBe('remember');
    expect(getSwipeDirection('four', ...at(40), 48)).toBe('remember');
    expect(getSwipeDirection('four', ...at(40), 48, false)).toBe('remember');
  });
});
