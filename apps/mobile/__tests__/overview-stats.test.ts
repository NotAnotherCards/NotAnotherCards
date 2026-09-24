import { overviewStats } from '@/lib/overview-stats';

const DAY = 86_400_000;
// Noon UTC, so "yesterday" and "today" are unambiguous UTC days.
const now = Date.UTC(2026, 8, 24, 12);
const card = (id: string, note_id: string) => ({ id, note_id });
const note = (id: string) => ({ id, created_at: 0 });
const review = (
  id: string,
  user_card_id: string,
  rating: number,
  at: number,
) => ({
  id,
  user_card_id,
  rating,
  reviewed_at: at,
});

describe('overviewStats', () => {
  it('is all zeros for a new account', () => {
    expect(overviewStats([], [], [], now)).toEqual({
      dictionarySize: 0,
      streak: 0,
      wordsLearned: 0,
    });
  });

  it('counts the cards in the dictionary, not the notes', () => {
    // A word note yields sibling cards; web's tile counts cards too.
    const cards = [card('c1', 'n1'), card('c2', 'n1'), card('c3', 'n2')];
    expect(
      overviewStats([], cards, [note('n1'), note('n2')], now).dictionarySize,
    ).toBe(3);
  });

  it('counts a streak of consecutive UTC days ending today', () => {
    const cards = [card('c1', 'n1')];
    const events = [
      review('r1', 'c1', 3, now - 2 * DAY),
      review('r2', 'c1', 3, now - DAY),
      review('r3', 'c1', 3, now),
    ];
    expect(overviewStats(events, cards, [note('n1')], now).streak).toBe(3);
  });

  it('counts a note once when several of its cards were answered well', () => {
    const cards = [card('c1', 'n1'), card('c2', 'n1'), card('c3', 'n2')];
    const events = [
      review('r1', 'c1', 3, now),
      review('r2', 'c2', 4, now),
      // Rating 1 is a failed answer and does not make n2 learned
      review('r3', 'c3', 1, now),
    ];
    expect(
      overviewStats(events, cards, [note('n1'), note('n2')], now).wordsLearned,
    ).toBe(1);
  });

  it('throws on a malformed review event instead of counting it', () => {
    // The hook turns this into an error message on the Overview
    const events = [review('r1', 'c1', 9, now)];
    expect(() =>
      overviewStats(events, [card('c1', 'n1')], [note('n1')], now),
    ).toThrow('Unsupported review rating');
  });
});
