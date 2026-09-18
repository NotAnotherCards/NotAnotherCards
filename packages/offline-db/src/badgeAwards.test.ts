import { describe, expect, it } from 'vitest';
import {
  selectEligibleBadgeCodes,
  selectReviewActivity,
  selectStreakActivity,
  type ActivityReviewEvent,
} from './activity.js';

const at = (iso: string) => new Date(iso).getTime();

function review(
  id: string,
  reviewedAt: string,
  rating = 3,
): ActivityReviewEvent {
  return {
    id,
    user_card_id: `card-${id}`,
    rating,
    reviewed_at: at(reviewedAt),
  };
}

/** Compute eligible badges with `now` fixed at 2026-09-08T12:00Z. */
function eligibleBadges(
  reviewEvents: ActivityReviewEvent[],
  now = at('2026-09-08T12:00:00.000Z'),
) {
  const { reviewCount } = selectReviewActivity(reviewEvents);
  const { longestStreak } = selectStreakActivity(reviewEvents, now);
  return selectEligibleBadgeCodes({ reviewCount, longestStreak });
}

describe('seven-day-streak badge edge cases', () => {
  it('does not award streak badge when a gap breaks 7 days into two runs', () => {
    // Days 1–3, gap on day 4, then days 5–8 → longest run is 4
    const events = [
      review('d1', '2026-09-01T12:00:00.000Z'),
      review('d2', '2026-09-02T12:00:00.000Z'),
      review('d3', '2026-09-03T12:00:00.000Z'),
      // gap: 2026-09-04
      review('d5', '2026-09-05T12:00:00.000Z'),
      review('d6', '2026-09-06T12:00:00.000Z'),
      review('d7', '2026-09-07T12:00:00.000Z'),
      review('d8', '2026-09-08T12:00:00.000Z'),
    ];

    const badges = eligibleBadges(events);

    expect(badges).toContain('first-review');
    expect(badges).not.toContain('seven-day-streak');
  });

  it('does not award streak badge from 7 non-consecutive dates across weeks', () => {
    // One review every other day — 7 reviews but never 7 in a row
    const events = Array.from({ length: 7 }, (_, i) =>
      review(
        `sparse-${i}`,
        `2026-09-${String(i * 2 + 1).padStart(2, '0')}T12:00:00.000Z`,
      ),
    );

    const badges = eligibleBadges(events, at('2026-09-14T12:00:00.000Z'));

    expect(badges).toContain('first-review');
    expect(badges).not.toContain('seven-day-streak');
  });

  it('awards streak badge when reviews fall at varying times across 7 consecutive UTC dates', () => {
    const events = [
      review('early', '2026-09-01T00:00:01.000Z'), // just past midnight
      review('morning', '2026-09-02T06:30:00.000Z'),
      review('noon', '2026-09-03T12:00:00.000Z'),
      review('evening', '2026-09-04T18:45:00.000Z'),
      review('late', '2026-09-05T23:59:59.000Z'), // just before midnight
      review('midday', '2026-09-06T11:11:11.000Z'),
      review('midnight', '2026-09-07T00:00:00.000Z'), // exactly midnight
    ];

    const badges = eligibleBadges(events);

    expect(badges).toEqual(['first-review', 'seven-day-streak']);
  });

  it('counts multiple reviews on the same UTC date as one streak day', () => {
    // 3 reviews on each of 7 days = 21 reviews but only 7 distinct days
    const events: ActivityReviewEvent[] = [];
    for (let day = 1; day <= 7; day++) {
      for (let session = 0; session < 3; session++) {
        events.push(
          review(
            `d${day}-s${session}`,
            `2026-09-${String(day).padStart(2, '0')}T${String(8 + session * 4).padStart(2, '0')}:00:00.000Z`,
          ),
        );
      }
    }

    const badges = eligibleBadges(events);

    expect(badges).toContain('first-review');
    expect(badges).toContain('seven-day-streak');
    // 21 reviews is not enough for hundred-reviews
    expect(badges).not.toContain('hundred-reviews');
  });

  it('awards streak badge at exactly 7 days but not at 6', () => {
    const sixDays = Array.from({ length: 6 }, (_, i) =>
      review(
        `six-${i}`,
        `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
      ),
    );

    expect(eligibleBadges(sixDays)).not.toContain('seven-day-streak');

    const sevenDays = [...sixDays, review('seven', '2026-09-07T12:00:00.000Z')];

    expect(eligibleBadges(sevenDays)).toContain('seven-day-streak');
  });
});
