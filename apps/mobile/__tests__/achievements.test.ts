import { achievements } from '@/lib/achievements';

describe('achievements', () => {
  it("lists every badge in web's order, all locked for a new account", () => {
    expect(achievements([])).toEqual([
      expect.objectContaining({
        code: 'first-review',
        name: 'First Step',
        unlockedAt: null,
      }),
      expect.objectContaining({
        code: 'seven-day-streak',
        name: 'Week Warrior',
        unlockedAt: null,
      }),
      expect.objectContaining({
        code: 'hundred-reviews',
        name: 'Century Mark',
        unlockedAt: null,
      }),
    ]);
  });

  it('marks the synced badges unlocked, with the server date', () => {
    const [first, week] = achievements([
      { badge_id: 'first-review', unlocked_at: 1_790_000_000_000 },
    ]);
    expect(first.unlockedAt).toBe(1_790_000_000_000);
    expect(week.unlockedAt).toBeNull();
  });

  it('leaves out a badge this app has no copy for', () => {
    // A newer server may award badges an older app does not know yet
    const list = achievements([
      { badge_id: 'polyglot', unlocked_at: 1 },
      { badge_id: 'hundred-reviews', unlocked_at: 2 },
    ]);
    expect(list.map((badge) => badge.code)).toEqual([
      'first-review',
      'seven-day-streak',
      'hundred-reviews',
    ]);
    expect(list[2].unlockedAt).toBe(2);
  });
});
