import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GamificationService } from '../../src/gamification/gamification.service';
import {
  badgeAwards,
  dailyChallengeCompletions,
} from '../../src/gamification/schema';
import {
  reviewEvents,
  userCards,
  userNotes,
  userProfiles,
} from '../../src/sync/schema';
import {
  db,
  hasPostgres,
  resetPostgres,
  setUpPostgres,
  tearDownPostgres,
} from '../sync/postgres-fixture';

const describePostgres = hasPostgres ? describe : describe.skip;
const now = Date.parse('2026-09-15T12:00:00.000Z');

describePostgres('GamificationService', () => {
  let service: GamificationService;

  beforeAll(async () => {
    await setUpPostgres();
    service = new GamificationService(db);
  }, 30_000);

  beforeEach(async () => {
    await resetPostgres();
  });

  afterAll(async () => {
    await tearDownPostgres();
  }, 30_000);

  const seedProfile = async (userId: string, username: string) => {
    await db.insert(userProfiles).values({
      userId,
      username,
      rev: sql`nextval('remelon_rev')`,
      createdAt: now,
      updatedAt: now,
    });
  };

  const seedReviews = async (
    userId: string,
    count: number,
    reachedAt: number,
  ) => {
    await db.insert(reviewEvents).values(
      Array.from({ length: count }, (_, index) => ({
        id: `${userId}-review-${index}`,
        userId,
        userCardId: `${userId}-card`,
        rating: (index % 4) + 1,
        reviewedAt: reachedAt - (count - index - 1) * 1_000,
        rev: sql`nextval('remelon_rev')`,
      })),
    );
  };

  it('upserts badges and UTC challenge completions idempotently', async () => {
    await db.insert(userNotes).values(
      Array.from({ length: 5 }, (_, index) => ({
        id: `note-${index}`,
        userId: 'user-a',
        noteType: 'basic',
        fieldsVersion: 1,
        fieldsJson: '{}',
        createdAt: now - index,
        updatedAt: now,
        rev: sql`nextval('remelon_rev')`,
      })),
    );
    await db.insert(userCards).values({
      id: 'user-a-card',
      userId: 'user-a',
      noteId: 'note-0',
      templateKey: 'basic-front-back',
      front: 'front',
      back: 'back',
      dueAt: now,
      createdAt: now,
      updatedAt: now,
      rev: sql`nextval('remelon_rev')`,
    });
    await seedReviews('user-a', 20, now);

    const first = await service.refreshAwards('user-a', now);
    const replay = await service.refreshAwards('user-a', now);

    expect(first).toEqual(replay);
    expect(first.points).toBe(20);
    expect(first.badges.map((badge) => badge.code)).toEqual(['first-review']);
    expect(first.dailyChallenges).toEqual([
      expect.objectContaining({
        code: 'daily-review',
        current: 20,
        completed: true,
      }),
      expect.objectContaining({
        code: 'new-vocabulary',
        current: 5,
        completed: true,
      }),
    ]);

    expect(await db.select().from(badgeAwards)).toHaveLength(1);
    const completions = await db.select().from(dailyChallengeCompletions);
    expect(completions).toHaveLength(2);
    expect(completions.every((row) => row.utcDate === '2026-09-15')).toBe(true);
  });

  it('persists every badge selected by the shared epic rules', async () => {
    const day = 86_400_000;
    await db.insert(reviewEvents).values(
      Array.from({ length: 100 }, (_, index) => ({
        id: `badge-review-${index}`,
        userId: 'user-a',
        userCardId: 'user-a-card',
        rating: (index % 4) + 1,
        reviewedAt: index < 7 ? now - (6 - index) * day : now - (index - 7),
        rev: sql`nextval('remelon_rev')`,
      })),
    );

    const summary = await service.refreshAwards('user-a', now);

    expect(summary.points).toBe(100);
    expect(summary.longestStreak).toBe(7);
    expect(summary.badges.map((badge) => badge.code)).toEqual([
      'first-review',
      'seven-day-streak',
      'hundred-reviews',
    ]);
  });

  it('backfills a completed UTC day received after midnight', async () => {
    const yesterday = Date.parse('2026-09-14T12:00:00.000Z');
    await seedReviews('user-a', 20, yesterday);
    await db.insert(userNotes).values(
      Array.from({ length: 5 }, (_, index) => ({
        id: `offline-note-${index}`,
        userId: 'user-a',
        noteType: 'basic',
        fieldsVersion: 1,
        fieldsJson: '{}',
        createdAt: yesterday,
        updatedAt: yesterday,
        rev: sql`nextval('remelon_rev')`,
      })),
    );

    const today = await service.refreshAwards('user-a', now);
    const completions = await db.select().from(dailyChallengeCompletions);

    expect(
      today.dailyChallenges.every((challenge) => !challenge.completed),
    ).toBe(true);
    expect(
      completions
        .map(
          (completion) => `${completion.utcDate}:${completion.challengeCode}`,
        )
        .sort(),
    ).toEqual(['2026-09-14:daily-review', '2026-09-14:new-vocabulary']);
  });

  it('ranks live public usernames by points, reached time, then username', async () => {
    await seedProfile('user-a', 'zebra');
    await seedProfile('user-b', 'alpha');
    await seedReviews('user-a', 2, now);
    await seedReviews('user-b', 2, now - 1_000);

    const first = await service.leaderboard('user-a', 1, 0);
    const repeated = await service.leaderboard('user-a', 1, 0);

    expect(first).toEqual(repeated);
    expect(first.entries).toEqual([
      { rank: 1, username: 'alpha', points: 2, isCurrentUser: false },
    ]);
    expect(first.currentUser).toEqual({
      rank: 2,
      username: 'zebra',
      points: 2,
      isCurrentUser: true,
    });
  });

  it('uses public username as the final deterministic tie-breaker', async () => {
    await seedProfile('user-a', 'zebra');
    await seedProfile('user-b', 'alpha');
    await seedReviews('user-a', 1, now);
    await seedReviews('user-b', 1, now);

    const result = await service.leaderboard('user-a', 2, 0);

    expect(result.entries.map((entry) => entry.username)).toEqual([
      'alpha',
      'zebra',
    ]);
  });
});
