import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  cardId,
  noteDeckId,
  REVIEW_INTERVAL_CAP_MINUTES,
} from '@repo/offline-db';
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

const modelIds = (suffix: string) => {
  const deck = `endpoint-deck-${suffix}`;
  const note = `endpoint-note-${suffix}`;
  return {
    deck,
    note,
    card: cardId(note, BASIC_FRONT_BACK_TEMPLATE_KEY),
    membership: noteDeckId(note, deck),
    review: `endpoint-review-${suffix}`,
  };
};

const modelChanges = (now: number, suffix: string) => {
  const ids = modelIds(suffix);
  return {
    user_decks: {
      created: [
        {
          id: ids.deck,
          title: `Endpoint deck ${suffix}`,
          description: null,
          created_at: now,
          updated_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
    user_notes: {
      created: [
        {
          id: ids.note,
          note_type: BASIC_NOTE_TYPE,
          fields_version: BASIC_NOTE_FIELDS_VERSION,
          fields_json: JSON.stringify({ front: 'front', back: 'back' }),
          additional_content: 'More content',
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
          id: ids.card,
          note_id: ids.note,
          template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
          active: true,
          front: 'front',
          back: 'back',
          due_at: now,
          scheduled_interval_minutes: 30,
          created_at: now,
          updated_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
    user_note_decks: {
      created: [
        {
          id: ids.membership,
          note_id: ids.note,
          deck_id: ids.deck,
          active: true,
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
          id: ids.review,
          user_card_id: ids.card,
          rating: 3,
          reviewed_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
  };
};

const invalidNoteCases = [
  {
    name: 'malformed JSON',
    suffix: 'malformed-json',
    note_type: BASIC_NOTE_TYPE,
    fields_version: BASIC_NOTE_FIELDS_VERSION,
    fields_json: '{invalid',
  },
  {
    name: 'unsupported note type',
    suffix: 'unsupported-type',
    note_type: 'word',
    fields_version: 1,
    fields_json: '{}',
  },
  {
    name: 'unsupported fields version',
    suffix: 'unsupported-version',
    note_type: BASIC_NOTE_TYPE,
    fields_version: 999,
    fields_json: JSON.stringify({ front: 'a', back: 'b' }),
  },
  {
    name: 'incomplete basic fields',
    suffix: 'incomplete-basic',
    note_type: BASIC_NOTE_TYPE,
    fields_version: BASIC_NOTE_FIELDS_VERSION,
    fields_json: JSON.stringify({ front: 'a' }),
  },
  {
    name: 'extra basic field',
    suffix: 'extra-basic-field',
    note_type: BASIC_NOTE_TYPE,
    fields_version: BASIC_NOTE_FIELDS_VERSION,
    fields_json: JSON.stringify({ front: 'a', back: 'b', hint: 'extra' }),
  },
] as const;

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
    googleId: process.env.GOOGLE_CLIENT_ID,
    googleSecret: process.env.GOOGLE_CLIENT_SECRET,
    facebookId: process.env.FACEBOOK_CLIENT_ID,
    facebookSecret: process.env.FACEBOOK_CLIENT_SECRET,
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
    process.env.GOOGLE_CLIENT_ID = 'dummy-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'dummy-google-client-secret';
    process.env.FACEBOOK_CLIENT_ID = 'dummy-facebook-client-id';
    process.env.FACEBOOK_CLIENT_SECRET = 'dummy-facebook-client-secret';

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
      truncate table review_events, user_note_decks, user_cards, user_notes, user_decks cascade;
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
    process.env.GOOGLE_CLIENT_SECRET = previousEnvironment.googleSecret;
    process.env.GOOGLE_CLIENT_ID = previousEnvironment.googleId;
    process.env.FACEBOOK_CLIENT_SECRET = previousEnvironment.facebookSecret;
    process.env.FACEBOOK_CLIENT_ID = previousEnvironment.facebookId;
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

  it.each(invalidNoteCases)(
    'rejects a note with $name without persisting it',
    async ({ suffix, note_type, fields_version, fields_json }) => {
      const now = Date.now();
      const noteId = `invalid-note-${suffix}`;
      const initial = await request(app.getHttpServer())
        .post('/sync/pull')
        .set('Cookie', userA.cookie)
        .send(pullBody(null))
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Cookie', userA.cookie)
        .send({
          cursor: (initial.body as { cursor: string }).cursor,
          changes: {
            user_notes: {
              created: [
                {
                  id: noteId,
                  note_type,
                  fields_version,
                  fields_json,
                  additional_content: null,
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

      expect(response.body).toMatchObject({
        rejected: { user_notes: [noteId] },
      });
      const persisted = await db.execute<{ count: string }>(
        `select count(*)::text as count from user_notes where id = '${noteId}'`,
      );
      expect(Number(persisted.rows[0]?.count)).toBe(0);
    },
  );

  it('rejects children and reviews of an invalid same-push note', async () => {
    const now = Date.now();
    const suffix = 'invalid-parent';
    const ids = modelIds(suffix);
    const changes = modelChanges(now, suffix);
    changes.user_notes.created[0].fields_json = '{invalid';
    const initial = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (initial.body as { cursor: string }).cursor,
        changes,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      rejected: {
        user_notes: [ids.note],
        user_cards: [ids.card],
        user_note_decks: [ids.membership],
        review_events: [ids.review],
      },
    });
    const persisted = await db.execute<{
      decks: string;
      notes: string;
      cards: string;
      memberships: string;
      reviews: string;
    }>(`
      select
        (select count(*) from user_decks)::text as decks,
        (select count(*) from user_notes)::text as notes,
        (select count(*) from user_cards)::text as cards,
        (select count(*) from user_note_decks)::text as memberships,
        (select count(*) from review_events)::text as reviews
    `);
    expect(persisted.rows[0]).toEqual({
      decks: '1',
      notes: '0',
      cards: '0',
      memberships: '0',
      reviews: '0',
    });
  });

  it('rejects an over-cap card and its same-push review without blocking valid rows', async () => {
    const now = Date.now();
    const ids = modelIds('interval-cap');
    const invalidTemplateKey = 'over-cap-template';
    const invalidCardId = cardId(ids.note, invalidTemplateKey);
    const invalidReviewId = 'endpoint-review-interval-over-cap';
    const changes = modelChanges(now, 'interval-cap');
    changes.user_cards.created[0].scheduled_interval_minutes =
      REVIEW_INTERVAL_CAP_MINUTES;
    changes.user_cards.created.push({
      id: invalidCardId,
      note_id: ids.note,
      template_key: invalidTemplateKey,
      active: true,
      front: 'over cap',
      back: 'over cap',
      due_at: now,
      scheduled_interval_minutes: REVIEW_INTERVAL_CAP_MINUTES + 1,
      created_at: now,
      updated_at: now,
    });
    changes.review_events.created.push({
      id: invalidReviewId,
      user_card_id: invalidCardId,
      rating: 3,
      reviewed_at: now,
    });
    const initial = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({ cursor: (initial.body as { cursor: string }).cursor, changes })
      .expect(200);

    expect(response.body).toMatchObject({
      rejected: {
        user_cards: [invalidCardId],
        review_events: [invalidReviewId],
      },
    });

    const persisted = await db.execute<{
      note_count: string;
      valid_interval: number | null;
      invalid_card_count: string;
      invalid_review_count: string;
    }>(`
      select
        (select count(*) from user_notes where id = '${ids.note}')::text as note_count,
        (select scheduled_interval_minutes from user_cards where id = '${ids.card}') as valid_interval,
        (select count(*) from user_cards where id = '${invalidCardId}')::text as invalid_card_count,
        (select count(*) from review_events where id = '${invalidReviewId}')::text as invalid_review_count
    `);
    expect(persisted.rows[0]).toEqual({
      note_count: '1',
      valid_interval: REVIEW_INTERVAL_CAP_MINUTES,
      invalid_card_count: '0',
      invalid_review_count: '0',
    });
  });

  it('serves the note model, isolates relationships, and preserves notes when decks are deleted', async () => {
    const now = Date.now();
    const ids = modelIds('a');
    const initialA = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (initialA.body as { cursor: string }).cursor,
        changes: modelChanges(now, 'a'),
      })
      .expect(200);
    const createdBody = created.body as {
      rejected?: Record<string, readonly string[]>;
    };
    expect(createdBody.rejected ?? {}).toEqual({});

    const owners = await db.execute<{ user_id: string }>(`
      select user_id from user_decks where id = '${ids.deck}'
      union all select user_id from user_notes where id = '${ids.note}'
      union all select user_id from user_cards where id = '${ids.card}'
      union all select user_id from user_note_decks where id = '${ids.membership}'
      union all select user_id from review_events where id = '${ids.review}'
    `);
    expect(owners.rows).toHaveLength(5);
    expect(owners.rows.every((row) => row.user_id === userA.id)).toBe(true);

    const pulledA = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);
    expect(pulledA.body).toMatchObject({
      changes: {
        user_notes: { updated: [expect.objectContaining({ id: ids.note })] },
        user_cards: { updated: [expect.objectContaining({ id: ids.card })] },
        user_note_decks: {
          updated: [expect.objectContaining({ id: ids.membership })],
        },
      },
    });

    const initialB = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userB.cookie)
      .send(pullBody(null))
      .expect(200);
    const initialBBody = initialB.body as {
      cursor: string;
      changes: {
        user_notes: { updated: unknown[] };
        user_note_decks: { updated: unknown[] };
      };
    };
    expect(initialBBody.changes.user_notes.updated).toEqual([]);
    expect(initialBBody.changes.user_note_decks.updated).toEqual([]);

    const foreignTemplate = 'foreign-template';
    const foreignCardId = cardId(ids.note, foreignTemplate);
    const foreignMembershipId = noteDeckId(ids.note, 'missing-user-b-deck');
    const rejected = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userB.cookie)
      .send({
        cursor: initialBBody.cursor,
        changes: {
          user_cards: {
            created: [
              {
                id: foreignCardId,
                note_id: ids.note,
                template_key: foreignTemplate,
                active: true,
                front: 'foreign',
                back: 'foreign',
                due_at: now,
                scheduled_interval_minutes: 0,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_note_decks: {
            created: [
              {
                id: foreignMembershipId,
                note_id: ids.note,
                deck_id: 'missing-user-b-deck',
                active: true,
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
    expect(rejected.body).toMatchObject({
      rejected: {
        user_cards: [foreignCardId],
        user_note_decks: [foreignMembershipId],
      },
    });

    const deletedDeck = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (pulledA.body as { cursor: string }).cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: [ids.deck] },
        },
      })
      .expect(200);
    const deletedDeckBody = deletedDeck.body as {
      changes: { user_note_decks: { deleted: string[] } };
    };
    expect(deletedDeckBody.changes.user_note_decks.deleted).toEqual([
      ids.membership,
    ]);

    const preserved = await db.execute<{
      note_active: boolean;
      card_active: boolean;
      review_active: boolean;
      due_at: number;
      scheduled_interval_minutes: number;
    }>(`
      select
        n.deleted_at is null as note_active,
        c.deleted_at is null as card_active,
        r.deleted_at is null as review_active,
        c.due_at,
        c.scheduled_interval_minutes
      from user_notes n
      join user_cards c on c.note_id = n.id
      join review_events r on r.user_card_id = c.id
      where n.id = '${ids.note}'
    `);
    expect(preserved.rows[0]).toEqual({
      note_active: true,
      card_active: true,
      review_active: true,
      due_at: now,
      scheduled_interval_minutes: 30,
    });
  });

  it('rejects review updates through the authenticated push endpoint', async () => {
    const now = Date.now();
    const ids = modelIds('append-only');
    const initial = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
      .expect(200);
    await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: (initial.body as { cursor: string }).cursor,
        changes: modelChanges(now, 'append-only'),
      })
      .expect(200);
    const seeded = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody(null))
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
                id: ids.review,
                user_card_id: ids.card,
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
      rejected: { review_events: [ids.review] },
    });
    const review = await db.execute<{ rating: number }>(
      `select rating from review_events where id = '${ids.review}'`,
    );
    expect(review.rows[0]?.rating).toBe(3);
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
    const expired = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', userA.cookie)
      .send(pullBody('0'))
      .expect(200);
    expect(expired.body).toEqual({ resyncRequired: true });
  });
});
