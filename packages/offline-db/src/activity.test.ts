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
  }> = {},
) {
  return selectActivitySummary({
    reviewEvents: [],
    cards: [],
    notes: [],
    now: at('2026-09-08T12:00:00.000Z'),
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
      utcDate: '2026-09-08',
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
      reviewPoints: 1,
      reviewCount: 1,
      learnedNoteCount: 1,
      eligibleBadgeCodes: ['first-review'],
    });
    expect(result.todayChallenges[0]).toMatchObject({ current: 1 });
  });

  it('awards one point for every supported rating', () => {
    const reviewEvents = [1, 2, 3, 4].map((rating) =>
      review(
        `rating-${rating}`,
        `2026-09-08T${String(rating + 7).padStart(2, '0')}:00:00.000Z`,
        rating,
      ),
    );

    const result = summary({ reviewEvents });

    expect(result.reviewPoints).toBe(4);
    expect(result.reviewCount).toBe(4);
    expect(result.reviewPointsReachedAt).toBe(at('2026-09-08T11:00:00.000Z'));

    for (const rating of [0, 5, 1.5]) {
      expect(() =>
        summary({
          reviewEvents: [
            review(`invalid-${rating}`, '2026-09-08T12:00:00.000Z', rating),
          ],
        }),
      ).toThrow(`Unsupported review rating: ${rating}`);
    }
  });

  it('uses the successful-rating threshold only for learned notes', () => {
    const result = summary({
      reviewEvents: [
        review('again', '2026-09-08T08:00:00.000Z', 1, 'card-again'),
        review('hard', '2026-09-08T09:00:00.000Z', 2, 'card-hard'),
        review('good', '2026-09-08T10:00:00.000Z', 3, 'card-good'),
        review('easy', '2026-09-08T11:00:00.000Z', 4, 'card-easy'),
      ],
      cards: [
        card('card-again', 'note-again'),
        card('card-hard', 'note-hard'),
        card('card-good', 'note-good'),
        card('card-easy', 'note-easy'),
      ],
      notes: [
        note('note-again', '2026-09-01T00:00:00.000Z'),
        note('note-hard', '2026-09-01T00:00:00.000Z'),
        note('note-good', '2026-09-01T00:00:00.000Z'),
        note('note-easy', '2026-09-01T00:00:00.000Z'),
      ],
    });

    expect(result.reviewPoints).toBe(4);
    expect(result.reviewCount).toBe(4);
    expect(result.learnedNoteCount).toBe(3);
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

  it('retains learned-note history when a reviewed card is deactivated', () => {
    const reviewEvents = [
      review('successful', '2026-09-08T10:00:00.000Z', 3, 'optional-sibling'),
    ];
    const notes = [note('note-1', '2026-09-01T09:00:00.000Z')];

    expect(
      summary({
        reviewEvents,
        cards: [card('optional-sibling', 'note-1', true)],
        notes,
      }).learnedNoteCount,
    ).toBe(1);
    expect(
      summary({
        reviewEvents,
        cards: [card('optional-sibling', 'note-1', false)],
        notes,
      }).learnedNoteCount,
    ).toBe(1);
  });

  it('groups streaks and challenges at the UTC midnight boundary', () => {
    const result = summary({
      now: at('2026-09-08T00:30:00.000Z'),
      reviewEvents: [
        review('before-midnight', '2026-09-07T23:59:59.000Z'),
        review('at-midnight', '2026-09-08T00:00:00.000Z'),
      ],
      notes: [
        note('before-midnight', '2026-09-07T23:59:59.000Z'),
        note('at-midnight', '2026-09-08T00:00:00.000Z'),
      ],
    });

    expect(result.utcDate).toBe('2026-09-08');
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
    expect(result.todayChallenges).toEqual([
      {
        code: 'daily-review',
        current: 1,
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

    expect(
      selectStreakActivity(yesterday, at('2026-09-08T12:00:00.000Z'))
        .currentStreak,
    ).toBe(3);
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
