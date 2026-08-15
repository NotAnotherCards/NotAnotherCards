import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { DATABASE_CONNECTION } from '../../src/database/database-connection';
import {
  db,
  getTestConnectionString,
  hasPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

interface TestUser {
  readonly id: string;
  readonly cookie: string;
}

const pullBody = (cursor: string | null) => ({
  cursor,
  schemaVersion: 1,
  migration: null,
});

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('authenticated remelonDB endpoints', () => {
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
        password: 'SyncEndpointPassword123!',
        name: `Sync ${label}`,
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

    userA = await signUp('sync-user-a');
    userB = await signUp('sync-user-b');
  }, 30_000);

  beforeEach(async () => {
    await db.execute(`
      truncate table review_events, user_cards, user_decks cascade;
      delete from remelon_revision_checkpoints;
      delete from remelon_sync_meta;
      alter sequence remelon_rev restart with 1;
    `);
  });

  afterAll(async () => {
    await app?.close();
    await tearDownPostgres();

    process.env.DATABASE_URL = previousEnvironment.databaseUrl;
    process.env.FRONTEND_URL = previousEnvironment.frontendUrl;
    process.env.BETTER_AUTH_SECRET = previousEnvironment.authSecret;
    process.env.BETTER_AUTH_URL = previousEnvironment.authUrl;
  }, 30_000);

  it('rejects unauthenticated and malformed requests with transport statuses', async () => {
    await request(app.getHttpServer())
      .post('/sync/pull')
      .send(pullBody(null))
      .expect(401);
    await request(app.getHttpServer()).post('/sync/push').send({}).expect(401);

    await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({ nonsense: true })
      .expect(400);
  });

  it('uses the authenticated user as the only scope and isolates reads and writes', async () => {
    const now = Date.now();
    const initialA = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);

    const rejectedScopeOverride = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (initialA.body as { cursor: string }).cursor,
        changes: {
          user_decks: {
            created: [
              {
                id: 'deck-a',
                user_id: userB.id,
                title: 'User A deck',
                description: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_cards: {
            created: [
              {
                id: 'card-a',
                user_id: userB.id,
                deck_id: 'deck-a',
                front: 'A front',
                back: 'A back',
                due_at: now,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          review_events: {
            created: [
              {
                id: 'review-a',
                user_id: userB.id,
                user_card_id: 'card-a',
                rating: 3,
                reviewed_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      })
      .expect(200);

    expect(rejectedScopeOverride.body).toMatchObject({
      rejected: {
        user_decks: ['deck-a'],
        user_cards: ['card-a'],
        review_events: ['review-a'],
      },
    });

    await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (rejectedScopeOverride.body as { cursor: string }).cursor,
        changes: {
          user_decks: {
            created: [
              {
                id: 'deck-a',
                title: 'User A deck',
                description: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_cards: {
            created: [
              {
                id: 'card-a',
                deck_id: 'deck-a',
                front: 'A front',
                back: 'A back',
                due_at: now,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          review_events: {
            created: [
              {
                id: 'review-a',
                user_card_id: 'card-a',
                rating: 3,
                reviewed_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      })
      .expect(200);

    const owners = await db.execute<{ table_name: string; user_id: string }>(`
      select 'user_decks' as table_name, user_id from user_decks where id = 'deck-a'
      union all
      select 'user_cards', user_id from user_cards where id = 'card-a'
      union all
      select 'review_events', user_id from review_events where id = 'review-a'
    `);
    expect(owners.rows).toHaveLength(3);
    expect(owners.rows.every((row) => row.user_id === userA.id)).toBe(true);

    const initialB = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userB.cookie)
      .send(pullBody(null))
      .expect(200);
    expect(
      (initialB.body as { changes: { user_decks: { updated: unknown[] } } })
        .changes.user_decks.updated,
    ).toEqual([]);

    const rejectedMutation = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userB.cookie)
      .send({
        cursor: (initialB.body as { cursor: string }).cursor,
        changes: {
          user_decks: {
            created: [],
            updated: [
              {
                id: 'deck-a',
                title: 'Stolen deck',
                description: null,
                created_at: now,
                updated_at: now + 1,
              },
            ],
            deleted: [],
          },
        },
      })
      .expect(200);
    expect(rejectedMutation.body).toMatchObject({
      rejected: { user_decks: ['deck-a'] },
    });

    const deck = await db.execute<{ title: string }>(
      `select title from user_decks where id = 'deck-a'`,
    );
    expect(deck.rows[0]?.title).toBe('User A deck');
  });

  it('rejects review updates through the authenticated push endpoint', async () => {
    const now = Date.now();
    const initial = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);

    const seeded = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (initial.body as { cursor: string }).cursor,
        changes: {
          user_decks: {
            created: [
              {
                id: 'deck-a',
                title: 'A deck',
                description: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_cards: {
            created: [
              {
                id: 'card-a',
                deck_id: 'deck-a',
                front: 'front',
                back: 'back',
                due_at: now,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          review_events: {
            created: [
              {
                id: 'review-a',
                user_card_id: 'card-a',
                rating: 3,
                reviewed_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      })
      .expect(200);

    const result = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (seeded.body as { cursor: string }).cursor,
        changes: {
          review_events: {
            created: [],
            updated: [
              {
                id: 'review-a',
                user_card_id: 'card-a',
                rating: 1,
                reviewed_at: now,
              },
            ],
            deleted: [],
          },
        },
      })
      .expect(200);

    expect(result.body).toMatchObject({
      rejected: { review_events: ['review-a'] },
    });
    const review = await db.execute<{ rating: number }>(
      `select rating from review_events where id = 'review-a'`,
    );
    expect(review.rows[0]?.rating).toBe(3);
  });

  it('rejects missing and cross-scope card and review relationships', async () => {
    const now = Date.now();
    const initialA = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);

    await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (initialA.body as { cursor: string }).cursor,
        changes: {
          user_decks: {
            created: [
              {
                id: 'deck-a',
                title: 'A deck',
                description: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_cards: {
            created: [
              {
                id: 'card-a',
                deck_id: 'deck-a',
                front: 'front',
                back: 'back',
                due_at: now,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      })
      .expect(200);

    const initialB = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userB.cookie)
      .send(pullBody(null))
      .expect(200);
    const rejected = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userB.cookie)
      .send({
        cursor: (initialB.body as { cursor: string }).cursor,
        changes: {
          user_cards: {
            created: [
              {
                id: 'card-cross-scope',
                deck_id: 'deck-a',
                front: 'front',
                back: 'back',
                due_at: now,
                created_at: now,
                updated_at: now,
              },
              {
                id: 'card-missing-parent',
                deck_id: 'missing-deck',
                front: 'front',
                back: 'back',
                due_at: now,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          review_events: {
            created: [
              {
                id: 'review-cross-scope',
                user_card_id: 'card-a',
                rating: 2,
                reviewed_at: now,
              },
              {
                id: 'review-missing-parent',
                user_card_id: 'missing-card',
                rating: 2,
                reviewed_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      })
      .expect(200);

    expect(rejected.body).toMatchObject({
      rejected: {
        user_cards: ['card-cross-scope', 'card-missing-parent'],
        review_events: ['review-cross-scope', 'review-missing-parent'],
      },
    });

    const rejectedRows = await db.execute<{ count: string }>(`
      select (
        (select count(*) from user_cards where user_id = '${userB.id}') +
        (select count(*) from review_events where user_id = '${userB.id}')
      )::text as count
    `);
    expect(Number(rejectedRows.rows[0]?.count)).toBe(0);
  });

  it('returns conflict and resyncRequired protocol variants with HTTP 200', async () => {
    const conflict = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({ cursor: 'not-a-cursor', changes: {} })
      .expect(200);
    expect(conflict.body).toEqual({ conflict: true });

    await db.execute(`
      insert into remelon_sync_meta (key, value)
      values ('gc_floor', 5)
      on conflict (key) do update set value = excluded.value
    `);

    const resync = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody('0'))
      .expect(200);
    expect(resync.body).toEqual({ resyncRequired: true });
  });
});
