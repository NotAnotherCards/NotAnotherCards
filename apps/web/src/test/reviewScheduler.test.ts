import { describe, expect, it } from 'vitest';
import {
  FORGOT_INTERVAL_MINUTES,
  REVIEW_INTERVAL_CAP_MINUTES,
  REVIEW_INTERVAL_FLOOR_MINUTES,
  REVIEW_INTERVAL_MULTIPLIERS,
  calculateReviewIntervalMinutes,
  calculateReviewSchedule,
} from '@repo/offline-db';

const DAY = 24 * 60;

describe('shared v1 review scheduler', () => {
  it('exports the agreed floors, multipliers, and cap', () => {
    expect(REVIEW_INTERVAL_FLOOR_MINUTES).toEqual({
      1: 5,
      2: DAY,
      3: 3 * DAY,
      4: 7 * DAY,
    });
    expect(REVIEW_INTERVAL_MULTIPLIERS).toEqual({
      2: 1.2,
      3: 2.5,
      4: 3.25,
    });
    expect(FORGOT_INTERVAL_MINUTES).toBe(5);
    expect(REVIEW_INTERVAL_CAP_MINUTES).toBe(120 * DAY);
  });

  it.each([
    [1, 5],
    [2, DAY],
    [3, 3 * DAY],
    [4, 7 * DAY],
  ])('applies the cold-start floor for rating %i', (rating, expected) => {
    expect(calculateReviewIntervalMinutes(0, rating)).toBe(expected);
  });

  it('multiplies the previous interval and rounds to a whole minute', () => {
    expect(calculateReviewIntervalMinutes(2 * DAY, 2)).toBe(
      Math.round(2 * DAY * 1.2),
    );
    expect(calculateReviewIntervalMinutes(3 * DAY, 3)).toBe(
      Math.round(3 * DAY * 2.5),
    );
    expect(calculateReviewIntervalMinutes(7 * DAY, 4)).toBe(
      Math.round(7 * DAY * 3.25),
    );
    expect(calculateReviewIntervalMinutes(2_003, 2)).toBe(2_404);
  });

  it('strictly resets Forgot and caps growing intervals at 120 days', () => {
    expect(calculateReviewIntervalMinutes(120 * DAY, 1)).toBe(5);
    expect(calculateReviewIntervalMinutes(100 * DAY, 4)).toBe(120 * DAY);
  });

  it('grows repeated Easy reviews through the agreed sequence', () => {
    let interval = 0;
    const sequence = Array.from({ length: 4 }, () => {
      interval = calculateReviewIntervalMinutes(interval, 4);
      return interval;
    });

    expect(sequence).toEqual([
      7 * DAY,
      Math.round(7 * DAY * 3.25),
      Math.round(7 * DAY * 3.25 * 3.25),
      120 * DAY,
    ]);
  });

  it('derives due_at from the same whole-minute interval', () => {
    const reviewedAt = Date.parse('2026-08-30T10:00:00Z');

    expect(calculateReviewSchedule(3 * DAY, 3, reviewedAt)).toEqual({
      scheduled_interval_minutes: Math.round(3 * DAY * 2.5),
      due_at: reviewedAt + Math.round(3 * DAY * 2.5) * 60_000,
    });
  });

  it('rejects invalid persisted state and ratings', () => {
    expect(() => calculateReviewIntervalMinutes(-1, 3)).toThrow(
      'non-negative integer',
    );
    expect(() => calculateReviewIntervalMinutes(0, 5)).toThrow(
      'Unsupported review rating',
    );
    expect(() => calculateReviewSchedule(0, 3, -1)).toThrow(
      'non-negative integer',
    );
  });
});
