import { describe, expect, it } from 'vitest';
import {
  formatReviewInterval,
  reviewRatingByAnswer,
  type ReviewAnswer,
} from './review-answers.js';
import { REVIEW_RATINGS } from './review-scheduler.js';

describe('reviewRatingByAnswer', () => {
  it('maps the four answers onto the four scheduler ratings in order', () => {
    const answers: ReviewAnswer[] = ['forgot', 'hard', 'remember', 'very-easy'];
    expect(answers.map((answer) => reviewRatingByAnswer[answer])).toEqual([
      ...REVIEW_RATINGS,
    ]);
  });
});

describe('formatReviewInterval', () => {
  it('picks the unit by size and pluralises', () => {
    expect(formatReviewInterval(5)).toBe('5 min');
    expect(formatReviewInterval(60)).toBe('1 hour');
    expect(formatReviewInterval(150)).toBe('3 hours');
    expect(formatReviewInterval(24 * 60)).toBe('1 day');
    expect(formatReviewInterval(10 * 24 * 60)).toBe('10 days');
  });
});
