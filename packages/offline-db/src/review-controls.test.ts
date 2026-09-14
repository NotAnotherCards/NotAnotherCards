import { describe, expect, it } from 'vitest';
import {
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  reviewRatingByAnswer,
} from './review-controls.js';

describe('shared review controls', () => {
  it('maps both label sets to the scheduler ratings', () => {
    expect(reviewAnswerLabels).toEqual({
      forgot: 'Forgot',
      hard: 'Struggled',
      remember: 'Remembered',
      'very-easy': 'Knew it',
    });
    expect(extendedReviewAnswerLabels).toEqual({
      forgot: 'Again',
      hard: 'Hard',
      remember: 'Good',
      'very-easy': 'Easy',
    });
    expect(reviewRatingByAnswer).toEqual({
      forgot: 1,
      hard: 2,
      remember: 3,
      'very-easy': 4,
    });
  });

  it('formats review intervals for controls on either client', () => {
    expect(formatReviewInterval(5)).toBe('5 min');
    expect(formatReviewInterval(60)).toBe('1 hour');
    expect(formatReviewInterval(3 * 24 * 60)).toBe('3 days');
  });
});
