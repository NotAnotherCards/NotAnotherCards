import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  gamificationLeaderboardSchema,
  gamificationMeSchema,
} from '@repo/schemas';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { DATABASE_CONNECTION } from '../../src/database/database-connection';
import { badgeAwards } from '../../src/gamification/schema';
import { reviewEvents, userCards, userProfiles } from '../../src/sync/schema';
import {
  db,
  getTestConnectionString,
  hasPostgres,
  setUpPostgres,
  tearDownPostgres,
} from '../sync/postgres-fixture';

interface TestUser {
  readonly id: string;
  readonly cookie: string;
}

const describePostgres = hasPostgres ? describe : describe.skip;
const now = Date.parse('2026-09-15T12:00:00.000Z');

describePostgres('gamification endpoints', () => {
  let app: INestApplication<App>;
  let userA: TestUser;
  let userB: TestUser;

  const previousEnvironment = {
    databaseUrl: process.env.DATABASE_URL,
    frontendUrl: process.env.FRONTEND_URL,
    authSecret: process.env.BETTER_AUTH_SECRET,
    authUrl: process.env.BETTER_AUTH_URL,
  };

  const signUp = async (label: string): Promise<TestUser> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: `${label}@example.test`,
        password: 'GamificationPassword123!',
        name: label,
        timezone: 'UTC',
      })
      .expect(200);
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    return {
      id: (response.body as { user: { id: string } }).user.id,
      cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; '),
    };
  };

  beforeAll(async () => {
    await setUpPostgres();
    process.env.DATABASE_URL = getTestConnectionString();
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(db)
      .compile();
    app = moduleFixture.createNestApplication({ logger: false });
    await app.init();
    userA = await signUp('gamification-a');
    userB = await signUp('gamification-b');
  }, 30_000);

  beforeEach(async () => {
    await db.execute(sql`
      truncate table daily_challenge_completions, badge_awards,
        user_profiles, review_events, user_note_decks, user_cards,
        user_notes, user_decks cascade
    `);
    await db.insert(userProfiles).values([
      {
        userId: userA.id,
        username: 'zebra',
        createdAt: now,
        updatedAt: now,
        rev: sql`nextval('remelon_rev')`,
      },
      {
        userId: userB.id,
        username: 'alpha',
        createdAt: now,
        updatedAt: now,
        rev: sql`nextval('remelon_rev')`,
      },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await tearDownPostgres();
    process.env.DATABASE_URL = previousEnvironment.databaseUrl;
    process.env.FRONTEND_URL = previousEnvironment.frontendUrl;
    process.env.BETTER_AUTH_SECRET = previousEnvironment.authSecret;
    process.env.BETTER_AUTH_URL = previousEnvironment.authUrl;
  }, 30_000);

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
        reviewedAt: reachedAt - (count - index - 1),
        rev: sql`nextval('remelon_rev')`,
      })),
    );
  };

  it('requires authentication for both account and cross-user reads', async () => {
    await request(app.getHttpServer()).get('/api/gamification/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/gamification/leaderboard')
      .expect(401);
  });

  it('returns only the caller activity and a bounded public leaderboard', async () => {
    await seedReviews(userA.id, 1, now);
    await seedReviews(userB.id, 2, now - 1_000);

    const personal = await request(app.getHttpServer())
      .get('/api/gamification/me')
      .set('Cookie', userA.cookie)
      .expect(200);
    expect(gamificationMeSchema.parse(personal.body).points).toBe(1);
    expect(JSON.stringify(personal.body)).not.toContain(userB.id);

    const leaderboard = await request(app.getHttpServer())
      .get('/api/gamification/leaderboard?limit=999&offset=-1')
      .set('Cookie', userA.cookie)
      .expect(200);
    const parsed = gamificationLeaderboardSchema.parse(leaderboard.body);
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
    expect(parsed.entries).toEqual([
      { rank: 1, username: 'alpha', points: 2, isCurrentUser: false },
      { rank: 2, username: 'zebra', points: 1, isCurrentUser: true },
    ]);
    for (const entry of parsed.entries) {
      expect(Object.keys(entry)).toEqual([
        'rank',
        'username',
        'points',
        'isCurrentUser',
      ]);
    }
    expect(JSON.stringify(leaderboard.body)).not.toContain('@example.test');
  });

  it('refreshes awards after an accepted sync push without syncing them', async () => {
    await db.insert(userCards).values({
      id: `${userA.id}-card`,
      userId: userA.id,
      noteId: 'durable-note',
      templateKey: 'basic-front-back',
      front: 'front',
      back: 'back',
      dueAt: now,
      createdAt: now,
      updatedAt: now,
      rev: sql`nextval('remelon_rev')`,
    });
    const pulled = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send({ cursor: null, schemaVersion: 1, migration: null })
      .expect(200);
    const pushBody = {
      cursor: (pulled.body as { cursor: string }).cursor,
      changes: {
        review_events: {
          created: [
            {
              id: 'synced-review',
              user_card_id: `${userA.id}-card`,
              rating: 1,
              reviewed_at: Date.now(),
            },
          ],
          updated: [],
          deleted: [],
        },
      },
    };
    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send(pushBody)
      .expect(200);
    const responseBody = response.body as {
      rejected?: Record<string, readonly string[]>;
    };
    expect(responseBody.rejected ?? {}).toEqual({});

    // The client can repeat a request after losing its response. The sync
    // protocol may answer conflict, but neither the point nor award doubles.
    await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send(pushBody)
      .expect(200);
    expect(await db.select().from(badgeAwards)).toEqual([
      expect.objectContaining({
        userId: userA.id,
        badgeCode: 'first-review',
      }),
    ]);
    const personal = await request(app.getHttpServer())
      .get('/api/gamification/me')
      .set('Cookie', userA.cookie)
      .expect(200);
    expect(gamificationMeSchema.parse(personal.body).points).toBe(1);

    const after = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send({ cursor: null, schemaVersion: 1, migration: null })
      .expect(200);
    expect(
      Object.keys((after.body as { changes: object }).changes),
    ).not.toEqual(
      expect.arrayContaining(['badge_awards', 'daily_challenge_completions']),
    );
  });
});
