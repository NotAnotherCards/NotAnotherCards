import { describe, expect, it } from 'vitest';
import {
  gamificationLeaderboardSchema,
  gamificationMeSchema,
} from './gamification';

describe('gamification API schemas', () => {
  it('accepts stable code-based personal summaries', () => {
    expect(
      gamificationMeSchema.parse({
        utcDate: '2026-09-15',
        points: 20,
        reviewCount: 20,
        learnedNoteCount: 5,
        currentStreak: 2,
        longestStreak: 7,
        badges: [{ code: 'first-review', awardedAt: 1_789_488_000_000 }],
        todayChallenges: [
          {
            code: 'daily-review',
            current: 20,
            target: 20,
            completed: true,
            completedAt: 1_789_488_000_000,
          },
          {
            code: 'new-vocabulary',
            current: 5,
            target: 5,
            completed: true,
            completedAt: 1_789_488_000_000,
          },
        ],
      }),
    ).toBeTruthy();
  });

  it('limits leaderboard rows to the public contract', () => {
    const result = gamificationLeaderboardSchema.parse({
      entries: [
        { rank: 1, username: 'learner', points: 42, isCurrentUser: true },
      ],
      currentUser: {
        rank: 1,
        username: 'learner',
        points: 42,
        isCurrentUser: true,
      },
      limit: 50,
      offset: 0,
    });

    expect(Object.keys(result.entries[0]!)).toEqual([
      'rank',
      'username',
      'points',
      'isCurrentUser',
    ]);
  });

  it('rejects unknown private fields at the response boundary', () => {
    expect(() =>
      gamificationLeaderboardSchema.parse({
        entries: [
          {
            rank: 1,
            username: 'learner',
            points: 42,
            isCurrentUser: true,
            userId: 'private-id',
          },
        ],
        currentUser: null,
        limit: 50,
        offset: 0,
      }),
    ).toThrow();
  });
});
