import { describe, expect, it } from 'vitest';
import type { ActivityNote, ActivityReviewEvent } from './activity.js';
import {
  selectDailyCounts,
  selectDueForecast,
  selectMonthlyCounts,
  selectMaturity,
  selectStatisticsRowsForDeck,
  type StatisticsCard,
  type StatisticsMembership,
} from './statistics.js';

const at = (iso: string) => new Date(iso).getTime();
const now = at('2026-09-16T12:00:00.000Z');

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

function card(
  id: string,
  noteId: string,
  dueAt = now,
  interval = 0,
): StatisticsCard {
  return {
    id,
    note_id: noteId,
    active: true,
    due_at: dueAt,
    scheduled_interval_minutes: interval,
  };
}

function membership(noteId: string, deckId: string): StatisticsMembership {
  return { note_id: noteId, deck_id: deckId, active: true };
}

describe('statistics selectors', () => {
  it('returns zero-filled UTC days oldest first for empty input', () => {
    expect(selectDailyCounts([], [], { days: 3, now })).toEqual([
      {
        utcDate: '2026-09-14',
        reviews: 0,
        notesAdded: 0,
        forgotRate: 0,
      },
      {
        utcDate: '2026-09-15',
        reviews: 0,
        notesAdded: 0,
        forgotRate: 0,
      },
      {
        utcDate: '2026-09-16',
        reviews: 0,
        notesAdded: 0,
        forgotRate: 0,
      },
    ]);
    expect(selectDueForecast([], { now })).toEqual({
      today: 0,
      tomorrow: 0,
      nextSevenDays: 0,
    });
    expect(selectMaturity([])).toEqual({
      new: 0,
      learning: 0,
      young: 0,
      mature: 0,
    });
  });

  it('groups daily activity at UTC midnight and computes forgot rate', () => {
    const result = selectDailyCounts(
      [
        review('before', '2026-09-15T23:59:59.999Z', 1),
        review('midnight', '2026-09-16T00:00:00.000Z', 1),
        review('remembered', '2026-09-16T10:00:00.000Z', 3),
      ],
      [
        note('before', '2026-09-15T23:59:59.999Z'),
        note('midnight', '2026-09-16T00:00:00.000Z'),
      ],
      { days: 2, now },
    );

    expect(result).toEqual([
      {
        utcDate: '2026-09-15',
        reviews: 1,
        notesAdded: 1,
        forgotRate: 1,
      },
      {
        utcDate: '2026-09-16',
        reviews: 2,
        notesAdded: 1,
        forgotRate: 0.5,
      },
    ]);
  });

  it('buckets by UTC month, oldest first, with a zero rate for empty months', () => {
    const rows = selectMonthlyCounts(
      [
        {
          id: 'r1',
          user_card_id: 'c',
          rating: 3,
          reviewed_at: Date.UTC(2026, 6, 31, 23, 59),
        },
        {
          id: 'r2',
          user_card_id: 'c',
          rating: 1,
          reviewed_at: Date.UTC(2026, 8, 1),
        },
        {
          id: 'r3',
          user_card_id: 'c',
          rating: 3,
          reviewed_at: Date.UTC(2026, 8, 16),
        },
      ],
      [{ id: 'n1', created_at: Date.UTC(2026, 7, 15) }],
      { months: 3, now: Date.UTC(2026, 8, 16, 12) },
    );

    expect(rows.map((row) => row.utcMonth)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(rows[0]).toMatchObject({ reviews: 1, notesAdded: 0, forgotRate: 0 });
    expect(rows[1]).toMatchObject({ reviews: 0, notesAdded: 1, forgotRate: 0 });
    expect(rows[2]).toMatchObject({
      reviews: 2,
      notesAdded: 0,
      forgotRate: 0.5,
    });
  });

  it('splits due cards into non-overlapping UTC forecast buckets', () => {
    const result = selectDueForecast(
      [
        card('overdue', 'note-1', at('2026-09-10T00:00:00.000Z')),
        card('today', 'note-2', at('2026-09-16T23:59:59.999Z')),
        card('tomorrow', 'note-3', at('2026-09-17T00:00:00.000Z')),
        card('next-seven-start', 'note-4', at('2026-09-18T00:00:00.000Z')),
        card('next-seven-end', 'note-5', at('2026-09-24T23:59:59.999Z')),
        card('later', 'note-6', at('2026-09-25T00:00:00.000Z')),
      ],
      { now },
    );

    expect(result).toEqual({ today: 2, tomorrow: 1, nextSevenDays: 2 });
  });

  it('uses the exact maturity boundaries', () => {
    expect(
      selectMaturity([
        card('new', 'note-1', now, 0),
        card('learning', 'note-2', now, 1_439),
        card('young-start', 'note-3', now, 1_440),
        card('young-end', 'note-4', now, 20 * 1_440),
        card('mature', 'note-5', now, 21 * 1_440),
      ]),
    ).toEqual({ new: 1, learning: 1, young: 2, mature: 1 });
  });

  it('excludes inactive cards from scoping, forecast, and maturity', () => {
    const inactive = {
      ...card('inactive', 'note-1', at('2026-09-16T10:00:00.000Z'), 30_240),
      active: false,
    };
    const reviews = [
      review('inactive-review', '2026-09-16T11:00:00.000Z', 3, inactive.id),
    ];

    expect(selectDueForecast([inactive], { now })).toEqual({
      today: 0,
      tomorrow: 0,
      nextSevenDays: 0,
    });
    expect(selectMaturity([inactive])).toEqual({
      new: 0,
      learning: 0,
      young: 0,
      mature: 0,
    });
    expect(
      selectStatisticsRowsForDeck(
        reviews,
        [inactive],
        [note('note-1', '2026-09-16T09:00:00.000Z')],
        [membership('note-1', 'deck-a')],
      ),
    ).toMatchObject({ reviewEvents: [], cards: [] });
  });

  it('attributes a note and its cards to every active deck membership', () => {
    const notes = [note('shared', '2026-09-16T09:00:00.000Z')];
    const cards = [card('shared-card', 'shared')];
    const reviews = [
      review('shared-review', '2026-09-16T10:00:00.000Z', 3, 'shared-card'),
    ];
    const memberships = [
      membership('shared', 'deck-a'),
      membership('shared', 'deck-b'),
      { ...membership('shared', 'inactive'), active: false },
    ];

    expect(
      selectStatisticsRowsForDeck(reviews, cards, notes, memberships, 'deck-a'),
    ).toEqual({ reviewEvents: reviews, cards, notes });
    expect(
      selectStatisticsRowsForDeck(reviews, cards, notes, memberships, 'deck-b'),
    ).toEqual({ reviewEvents: reviews, cards, notes });
    expect(
      selectStatisticsRowsForDeck(
        reviews,
        cards,
        notes,
        memberships,
        'inactive',
      ),
    ).toEqual({ reviewEvents: [], cards: [], notes: [] });
  });
});
