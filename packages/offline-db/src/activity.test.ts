import { describe, expect, it } from 'vitest';
import {
  selectActivitySummary,
  selectStreakActivity,
  type ActivityCard,
  type ActivityNote,
  type ActivityReviewEvent,
} from './activity.js';

const at = (iso: string) => new Date(iso).getTime();

function review(
  id: string,
  reviewedAt: string,
  rating = 3,
  cardId = `card-${id}`,
): ActivityReviewEvent {
  return {
    id,
    user_card_id: cardId,
    rating,
    reviewed_at: at(reviewedAt),
  };
}

function note(id: string, createdAt: string): ActivityNote {
  return { id, created_at: at(createdAt) };
}

function card(id: string, noteId: string, active = true): ActivityCard {
  return { id, note_id: noteId, active };
}

function summary(
  overrides: Partial<{
    reviewEvents: ActivityReviewEvent[];
    cards: ActivityCard[];
    notes: ActivityNote[];
    now: number;
    timeZone: string | null;
  }> = {},
) {
  return selectActivitySummary({
    reviewEvents: [],
    cards: [],
    notes: [],
    now: at('2026-09-08T12:00:00.000Z'),
    timeZone: 'UTC',
    ...overrides,
  });
}

describe('shared activity and gamification rules', () => {
  it('returns truthful zero values for empty history', () => {
    expect(summary()).toEqual({
      reviewPoints: 0,
      reviewCount: 0,
      reviewPointsReachedAt: null,
      learnedNoteCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      timeZone: 'UTC',
      localDate: '2026-09-08',
      todayChallenges: [
        {
          code: 'daily-review',
          current: 0,
          target: 20,
          completed: false,
        },
        {
          code: 'new-vocabulary',
          current: 0,
          target: 5,
          completed: false,
        },
      ],
      eligibleBadgeCodes: [],
    });
  });

  it('counts a duplicated review event id only once', () => {
    const event = review('same-id', '2026-09-08T10:00:00.000Z', 4, 'card-1');
    const result = summary({
      reviewEvents: [event, { ...event }],
      cards: [card('card-1', 'note-1')],
      notes: [note('note-1', '2026-09-08T09:00:00.000Z')],
    });

    expect(result).toMatchObject({
      reviewPoints: 4,
      reviewCount: 1,
      learnedNoteCount: 1,
      eligibleBadgeCodes: ['first-review'],
    });
    expect(result.todayChallenges[0]).toMatchObject({ current: 1 });
  });

  it('uses the fixed rating boundaries for points and learned notes', () => {
    const result = summary({
      reviewEvents: [
        review('again', '2026-09-08T08:00:00.000Z', 1, 'card-again'),
        review('hard', '2026-09-08T09:00:00.000Z', 2, 'card-hard'),
        review('easy', '2026-09-08T10:00:00.000Z', 4, 'card-easy'),
      ],
      cards: [
        card('card-again', 'note-again'),
        card('card-hard', 'note-hard'),
        card('card-easy', 'note-easy'),
      ],
      notes: [
        note('note-again', '2026-09-01T00:00:00.000Z'),
        note('note-hard', '2026-09-01T00:00:00.000Z'),
        note('note-easy', '2026-09-01T00:00:00.000Z'),
      ],
    });

    expect(result.reviewPoints).toBe(7);
    expect(result.reviewCount).toBe(3);
    expect(result.reviewPointsReachedAt).toBe(at('2026-09-08T10:00:00.000Z'));
    expect(result.learnedNoteCount).toBe(2);
    expect(() =>
      summary({
        reviewEvents: [
          review('invalid', '2026-09-08T11:00:00.000Z', 5, 'card-easy'),
        ],
      }),
    ).toThrow('Unsupported review rating: 5');
  });

  it('counts one distinct note for reviewed sibling cards and new vocabulary', () => {
    const result = summary({
      reviewEvents: [
        review('one', '2026-09-08T10:00:00.000Z', 3, 'sibling-a'),
        review('two', '2026-09-08T11:00:00.000Z', 3, 'sibling-b'),
      ],
      cards: [card('sibling-a', 'note-1'), card('sibling-b', 'note-1')],
      notes: [note('note-1', '2026-09-08T09:00:00.000Z')],
    });

    expect(result.learnedNoteCount).toBe(1);
    expect(result.todayChallenges).toEqual([
      {
        code: 'daily-review',
        current: 2,
        target: 20,
        completed: false,
      },
      {
        code: 'new-vocabulary',
        current: 1,
        target: 5,
        completed: false,
      },
    ]);
  });

  it('uses calendar dates rather than 24-hour periods across DST', () => {
    const result = summary({
      timeZone: 'Europe/Berlin',
      now: at('2026-03-30T10:00:00.000Z'),
      reviewEvents: [
        // Berlin changes from CET to CEST on 2026-03-29. These local review
        // times are on three consecutive dates despite unequal UTC offsets.
        review('day-1', '2026-03-27T22:30:00.000Z'),
        review('day-2', '2026-03-28T22:30:00.000Z'),
        review('day-3', '2026-03-29T21:30:00.000Z'),
      ],
    });

    expect(result.localDate).toBe('2026-03-30');
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('falls back to UTC for an absent or invalid timezone', () => {
    const input = {
      reviewEvents: [review('near-midnight', '2026-09-07T23:30:00.000Z')],
      now: at('2026-09-08T00:30:00.000Z'),
    };

    expect(selectStreakActivity(input.reviewEvents, input.now)).toEqual(
      selectStreakActivity(input.reviewEvents, input.now, 'Not/A_Timezone'),
    );
    expect(summary({ ...input, timeZone: 'Not/A_Timezone' })).toMatchObject({
      timeZone: 'UTC',
      localDate: '2026-09-08',
      currentStreak: 1,
    });
  });

  it('keeps the longest run but restarts the current streak after a gap', () => {
    const result = summary({
      now: at('2026-09-08T12:00:00.000Z'),
      reviewEvents: [
        review('day-1', '2026-09-03T12:00:00.000Z'),
        review('day-2', '2026-09-04T12:00:00.000Z'),
        review('after-gap', '2026-09-08T12:00:00.000Z'),
      ],
    });

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(2);
  });

  it("keeps yesterday's streak current but expires an older streak", () => {
    const yesterday = [
      review('day-1', '2026-09-05T12:00:00.000Z'),
      review('day-2', '2026-09-06T12:00:00.000Z'),
      review('yesterday', '2026-09-07T12:00:00.000Z'),
    ];

    expect(summary({ reviewEvents: yesterday }).currentStreak).toBe(3);
    expect(
      summary({ reviewEvents: yesterday.slice(0, -1) }).currentStreak,
    ).toBe(0);
  });

  it('returns all eligible badge codes in stable order', () => {
    const reviewEvents = Array.from({ length: 100 }, (_, index) =>
      review(
        `review-${index}`,
        `2026-09-${String((index % 7) + 1).padStart(2, '0')}T12:00:00.000Z`,
        1,
      ),
    );

    expect(summary({ reviewEvents }).eligibleBadgeCodes).toEqual([
      'first-review',
      'seven-day-streak',
      'hundred-reviews',
    ]);
  });

  it('marks each daily challenge complete at its fixed target', () => {
    const result = summary({
      reviewEvents: Array.from({ length: 20 }, (_, index) =>
        review(`today-${index}`, '2026-09-08T10:00:00.000Z'),
      ),
      notes: Array.from({ length: 5 }, (_, index) =>
        note(`new-${index}`, '2026-09-08T09:00:00.000Z'),
      ),
    });

    expect(result.todayChallenges).toEqual([
      {
        code: 'daily-review',
        current: 20,
        target: 20,
        completed: true,
      },
      {
        code: 'new-vocabulary',
        current: 5,
        target: 5,
        completed: true,
      },
    ]);
  });
});
