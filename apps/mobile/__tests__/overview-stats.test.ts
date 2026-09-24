import { dailyGoals, overviewStats } from '@/lib/overview-stats';

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
    expect(overviewStats([], [], [], now)).toMatchObject({
      dictionarySize: 0,
      streak: 0,
      wordsLearned: 0,
      challenges: [
        { code: 'daily-review', current: 0, target: 20, completed: false },
        { code: 'new-vocabulary', current: 0, target: 5, completed: false },
      ],
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

describe('today in the daily challenges', () => {
  it("counts today's reviews and today's new notes, not yesterday's", () => {
    const cards = [card('c1', 'n1')];
    const notes = [
      { id: 'n1', created_at: now - 60_000 },
      { id: 'n2', created_at: now - DAY },
    ];
    const events = [
      review('r1', 'c1', 3, now - 60_000),
      review('r2', 'c1', 1, now - 30_000),
      review('r3', 'c1', 3, now - DAY),
    ];
    const [reviews, vocabulary] = overviewStats(
      events,
      cards,
      notes,
      now,
    ).challenges;
    // A failed answer still counts: one review, one point
    expect(reviews.current).toBe(2);
    expect(vocabulary.current).toBe(1);
  });
});

describe('dailyGoals', () => {
  it("uses web's copy, progress and remaining count", () => {
    const [review, vocabulary] = dailyGoals([
      { code: 'daily-review', current: 12, target: 20, completed: false },
      { code: 'new-vocabulary', current: 7, target: 5, completed: true },
    ]);
    expect(review).toMatchObject({
      title: 'Daily Review',
      description: 'Review at least 20 words due today',
      progress: '12 / 20',
      percent: 60,
      reward: '8 remaining',
    });
    // Past the target: the bar stops full, the goal reads completed
    expect(vocabulary).toMatchObject({
      title: 'New Vocabulary',
      description: 'Add 5 new words to your personal dictionary',
      percent: 100,
      completed: true,
      reward: 'Completed',
    });
  });
});
