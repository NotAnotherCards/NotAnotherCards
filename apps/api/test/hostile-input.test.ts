import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  cardId,
  noteDeckId,
} from '@repo/offline-db';
import {
  aiJobResponseSchema,
  aiPlaygroundEventSchema,
  apiErrorBodySchema,
  ENGLISH,
  moderationExplanationEventSchema,
  SPANISH,
} from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import request, { type Response } from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/configure-http';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import { user } from '../src/database/schema';
import { aiGenerationJobs } from '../src/ai/schema';
import { AiGatewayService } from '../src/ai/ai-gateway.service';
import {
  deckReports,
  deckTakedowns,
  publishedDecks,
} from '../src/sharing/schema';
import { userDecks, userProfiles } from '../src/sync/schema';
import {
  db,
  getTestConnectionString,
  hasPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './sync/postgres-fixture';

const origin = 'http://localhost:5173';
const password = 'HostileInputPassword123!';
const email = 'corpus-owner@example.test';
const operatorKey = 'corpus-operator-key';
const sharedDeckId = 'corpus-published-deck';
const sharedCardId = 'corpus-published-card';
const otherOwnerId = 'corpus-other-owner';
const injections = ['<script>alert(1)</script>', "' OR 1=1 --"];
const oversized = 'x'.repeat(1024 * 1024 + 1);
const unknownFields = {
  unexpected: '<script>alert(1)</script>',
  userId: "' OR 1=1 --",
  onBoardingComplete: true,
};

interface Context {
  cursor: string;
  userId: string;
}

const profileRow = (userId: string, text: string) => ({
  id: userId,
  username: 'corpus_user',
  bio: text,
  avatar_file_id: null,
  native_language_id: ENGLISH,
  target_language_id: SPANISH,
  target_language_active: true,
  created_at: Date.now(),
  updated_at: Date.now(),
});

function contentChanges(text: string) {
  const now = Date.now();
  const note = 'corpus-note';
  const deck = 'corpus-deck';
  const changes = <T>(row: T) => ({ created: [row], updated: [], deleted: [] });
  return {
    user_decks: changes({
      id: deck,
      title: text,
      description: text,
      visibility: 'private',
      note_type: 'basic',
      native_language_id: null,
      target_language_id: null,
      created_at: now,
      updated_at: now,
    }),
    user_notes: changes({
      id: note,
      note_type: 'basic',
      fields_version: 1,
      fields_json: JSON.stringify({ front: text, back: text }),
      additional_content: text,
      created_at: now,
      updated_at: now,
    }),
    user_cards: changes({
      id: cardId(note, BASIC_FRONT_BACK_TEMPLATE_KEY),
      note_id: note,
      template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
      active: true,
      front: text,
      back: text,
      due_at: now,
      scheduled_interval_minutes: 0,
      created_at: now,
      updated_at: now,
    }),
    user_note_decks: changes({
      id: noteDeckId(note, deck),
      note_id: note,
      deck_id: deck,
      active: true,
      created_at: now,
      updated_at: now,
    }),
  };
}

interface Endpoint {
  name: string;
  path: string;
  kind:
    | 'signup'
    | 'signin'
    | 'onboard'
    | 'sync'
    | 'job'
    | 'playground'
    | 'update-user'
    | 'report'
    | 'takedown'
    | 'explain';
  valid: (context: Context, text: string) => Record<string, unknown>;
  wrongTypes: Record<string, unknown>;
  injectionStatus: number;
  unknownStatus: number;
}

let signupSequence = 0;
const endpoints: Endpoint[] = [
  {
    name: 'email signup',
    path: '/api/auth/sign-up/email',
    kind: 'signup',
    valid: (_context, text) => ({
      email: `corpus-signup-${++signupSequence}@example.test`,
      password,
      name: text,
      timezone: 'UTC',
    }),
    wrongTypes: { email: [], password: {}, name: 42 },
    injectionStatus: 200,
    unknownStatus: 200,
  },
  {
    name: 'email signin',
    path: '/api/auth/sign-in/email',
    kind: 'signin',
    valid: () => ({ email, password }),
    wrongTypes: { email: 42, password: [] },
    injectionStatus: 400,
    unknownStatus: 200,
  },
  {
    name: 'onboarding',
    path: '/api/auth/onboard',
    kind: 'onboard',
    valid: (_context, text) => ({
      username: text,
      native_language_id: ENGLISH,
      target_language_id: SPANISH,
    }),
    wrongTypes: {
      username: {},
      native_language_id: 42,
      target_language_id: [],
    },
    injectionStatus: 400,
    unknownStatus: 200,
  },
  {
    name: 'sync push',
    path: '/sync/push',
    kind: 'sync',
    valid: ({ cursor, userId }, text) => ({
      cursor,
      changes: {
        ...contentChanges(text),
        user_profiles: {
          created: [profileRow(userId, text)],
          updated: [],
          deleted: [],
        },
      },
    }),
    wrongTypes: { cursor: 42, changes: [] },
    injectionStatus: 200,
    unknownStatus: 400,
  },
  ...(['topic_deck', 'text_cards', 'word_note'] as const).map(
    (type): Endpoint => ({
      name: `AI ${type} job`,
      path: '/api/ai/generate',
      kind: 'job',
      valid: (_context, text) =>
        type === 'topic_deck'
          ? { type, topic: text, count: 1 }
          : type === 'text_cards'
            ? { type, sourceText: text, count: 1 }
            : {
                type,
                deckId: 'corpus-word-deck',
                word: text,
                direction: 'target',
              },
      wrongTypes:
        type === 'topic_deck'
          ? { topic: {}, count: '1' }
          : type === 'text_cards'
            ? { sourceText: [], count: '1' }
            : { deckId: [], word: 42, direction: {} },
      injectionStatus: 201,
      unknownStatus: 201,
    }),
  ),
  {
    name: 'AI playground',
    path: '/api/ai/playground/stream',
    kind: 'playground',
    valid: (_context, text) => ({ type: 'topic_deck', topic: text, count: 1 }),
    wrongTypes: { topic: [], count: '1' },
    injectionStatus: 200,
    unknownStatus: 200,
  },
  {
    name: 'update user',
    path: '/api/auth/update-user',
    kind: 'update-user',
    valid: (_context, text) => ({ name: text, timezone: 'UTC' }),
    wrongTypes: { name: {}, timezone: [] },
    injectionStatus: 200,
    // Better Auth rejects writes to the known server-owned onboarding flag.
    unknownStatus: 400,
  },
  {
    name: 'deck report',
    path: `/api/shared/decks/${sharedDeckId}/report`,
    kind: 'report',
    valid: (_context, text) => ({ reason: text }),
    wrongTypes: { reason: [] },
    injectionStatus: 201,
    unknownStatus: 201,
  },
  {
    name: 'operator takedown',
    path: `/api/operator/decks/${sharedDeckId}/takedown`,
    kind: 'takedown',
    valid: (_context, text) => ({ reason: text }),
    wrongTypes: { reason: {} },
    injectionStatus: 200,
    unknownStatus: 200,
  },
  {
    name: 'moderation explanation',
    path: `/api/decks/${sharedDeckId}/moderation/explain`,
    kind: 'explain',
    valid: (_context, text) => ({
      cardId: sharedCardId,
      reason: text,
      source: 'published',
    }),
    wrongTypes: { cardId: [], reason: {}, source: 42 },
    injectionStatus: 200,
    unknownStatus: 200,
  },
];

interface CorpusCase {
  name: string;
  body: (endpoint: Endpoint, context: Context) => string | undefined;
  status: (endpoint: Endpoint) => number;
  text?: string;
}

const corpus: CorpusCase[] = [
  { name: 'no body', body: () => undefined, status: () => 400 },
  { name: 'empty object', body: () => '{}', status: () => 400 },
  { name: 'null', body: () => 'null', status: () => 400 },
  { name: 'malformed JSON', body: () => '{"broken":', status: () => 400 },
  { name: 'array body', body: () => '[]', status: () => 400 },
  {
    name: 'wrong-typed fields',
    body: (endpoint, context) =>
      JSON.stringify({
        ...endpoint.valid(context, 'corpus_user'),
        ...endpoint.wrongTypes,
      }),
    status: () => 400,
  },
  {
    name: 'oversized body',
    body: (endpoint, context) =>
      JSON.stringify({
        ...endpoint.valid(context, 'corpus_user'),
        padding: oversized,
      }),
    status: () => 413,
  },
  ...injections.map((text): CorpusCase => ({
    name: `injection ${text}`,
    text,
    body: (endpoint, context) =>
      JSON.stringify({
        ...endpoint.valid(context, text),
        ...(endpoint.kind === 'signin' ? { email: text } : {}),
      }),
    status: (endpoint) => endpoint.injectionStatus,
  })),
  {
    name: 'unknown fields',
    text: 'corpus_user',
    body: (endpoint, context) =>
      JSON.stringify({
        ...endpoint.valid(context, 'corpus_user'),
        ...unknownFields,
      }),
    status: (endpoint) => endpoint.unknownStatus,
  },
];

// apiErrorBodySchema deliberately catches invalid inputs, so safeParse alone
// would also accept HTML, null, or an empty body. Require its message contract.
function expectJsonError(response: Response, status: number): void {
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
  expect(response.status, response.text).toBe(status);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  const body: unknown = JSON.parse(response.text);
  expect(apiErrorBodySchema.parse(body).message).toEqual(expect.any(String));
  expect(apiErrorBodySchema.parse(body).message).not.toBe('');
}

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('hostile input at the HTTP boundary (#253)', () => {
  let app: NestExpressApplication;
  let cookie: string;
  let context: Context;
  let tables: string[];
  let generateText: MockInstance<AiGatewayService['generateText']>;

  // Use real public snapshots and the correct owner for each route. A missing
  // deck, self-report, or absent finding must not conceal bypassed validation.
  async function prepareEndpoint(endpoint: Endpoint) {
    if (!['report', 'takedown', 'explain'].includes(endpoint.kind)) return;
    const ownerId = endpoint.kind === 'report' ? otherOwnerId : context.userId;
    const now = Date.now();
    await db.insert(userDecks).values({
      id: sharedDeckId,
      userId: ownerId,
      rev: sql`nextval('remelon_rev')`,
      title: 'Published corpus deck',
      noteType: 'basic',
      visibility: 'public',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(publishedDecks).values({
      deckId: sharedDeckId,
      userId: ownerId,
      title: 'Published corpus deck',
      noteType: 'basic',
      cardCount: 1,
      content: {
        notes: [],
        cards: [
          {
            id: sharedCardId,
            note_id: 'corpus-published-note',
            template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
            front: 'Front',
            back: 'Back',
          },
        ],
      },
      moderationVerdict: {
        flagged: [],
        warnings: [...injections, 'corpus_user'].map((reason) => ({
          cardId: sharedCardId,
          reason,
        })),
      },
    });
  }

  // Compare complete rows, including auth accounts/sessions and onboarding
  // flags: counts alone would miss damaged existing rows or partial updates.
  const snapshot = async () => {
    const result = await db.execute<{ table: string; rows: unknown }>(
      sql.join(
        tables.map(
          (table) => sql`
          select ${table}::text as "table",
            coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) as rows
          from ${sql.identifier(table)} t
        `,
        ),
        sql` union all `,
      ),
    );
    return result.rows;
  };

  beforeAll(async () => {
    await setUpPostgres();
    vi.stubEnv('DATABASE_URL', getTestConnectionString());
    vi.stubEnv('FRONTEND_URL', origin);
    vi.stubEnv('BETTER_AUTH_SECRET', 'corpus-secret-at-least-32-characters');
    vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
    vi.stubEnv('NODE_ENV', 'test'); // Better Auth rate limits must not mask validation.
    vi.stubEnv('AI_WORKER_ENABLED', 'false');
    vi.stubEnv('AI_MOCK', '1');
    vi.stubEnv('AI_API_BASE', '');
    vi.stubEnv('MODERATION_OPERATOR_KEY', operatorKey);

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(db)
      .compile();
    app = module.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureHttp(app);
    await app.init();
    generateText = vi.spyOn(app.get(AiGatewayService), 'generateText');

    const signup = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', origin)
      .send({ email, password, name: 'Corpus Owner', timezone: 'UTC' })
      .expect(200);
    cookie = (signup.get('Set-Cookie') ?? [])
      .map((value) => value.split(';')[0])
      .join('; ');
    expect(cookie).toContain('better-auth.session_token=');
    const owner = await db.select().from(user).where(eq(user.email, email));
    context = { userId: owner[0].id, cursor: '' };
    await db.insert(user).values({
      id: otherOwnerId,
      name: 'Other Owner',
      email: 'corpus-other-owner@example.test',
    });
    const result = await db.execute<{ tablename: string }>(sql`
      select tablename from pg_tables where schemaname = 'public' order by tablename
    `);
    tables = result.rows.map((row) => row.tablename);
  }, 30_000);

  beforeEach(async () => {
    generateText.mockClear();
    await db.execute(sql`
      truncate daily_challenge_completions, badge_awards, deck_takedowns,
        deck_reports, published_decks, user_profiles, review_events,
        user_note_decks, user_cards, user_notes, user_decks,
        ai_generation_jobs, ai_usage cascade;
      delete from remelon_revision_checkpoints;
      delete from remelon_sync_meta;
      update "user" set on_boarding_complete = false;
    `);
    await db
      .update(user)
      .set({ name: 'Corpus Owner', image: null, timezone: 'UTC' })
      .where(eq(user.id, context.userId));
    // A genuine owned word deck lets valid word_note requests reach the queue.
    // Otherwise a 404 could conceal a missing DTO validation check.
    const pull = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', cookie)
      .send({ cursor: null, schemaVersion: 1, migration: null })
      .expect(200);
    context.cursor = (pull.body as { cursor: string }).cursor;
    const deck = contentChanges('Owned word deck').user_decks.created[0];
    const push = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', cookie)
      .send({
        cursor: context.cursor,
        changes: {
          user_decks: {
            created: [
              {
                ...deck,
                id: 'corpus-word-deck',
                note_type: 'word',
                native_language_id: ENGLISH,
                target_language_id: SPANISH,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      })
      .expect(200);
    expect((push.body as { rejected?: unknown }).rejected ?? {}).toEqual({});
    context.cursor = (push.body as { cursor: string }).cursor;
  });

  afterAll(async () => {
    try {
      await app?.close();
      await tearDownPostgres();
    } finally {
      generateText?.mockRestore();
      vi.unstubAllEnvs();
    }
  }, 30_000);

  async function expectAccepted(
    endpoint: Endpoint,
    response: Response,
    text: string,
  ): Promise<void> {
    if (endpoint.kind === 'signup' || endpoint.kind === 'signin') {
      const body = response.body as {
        user: { id: string; name: string; email: string };
      };
      const [stored] = await db
        .select()
        .from(user)
        .where(eq(user.id, body.user.id));
      expect(stored.name).toBe(
        endpoint.kind === 'signup' ? text : 'Corpus Owner',
      );
      expect(body.user.name).toBe(stored.name);
      expect(stored.onBoardingComplete).toBe(false);
      expect(stored.id).not.toBe(unknownFields.userId);
      const session = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set(
          'Cookie',
          (response.get('Set-Cookie') ?? [])
            .map((value) => value.split(';')[0])
            .join('; '),
        )
        .expect(200);
      expect((session.body as { user: { name: string } }).user.name).toBe(
        stored.name,
      );
    } else if (endpoint.kind === 'onboard') {
      const [profile] = await db.select().from(userProfiles);
      expect(profile).toMatchObject({
        userId: context.userId,
        username: text,
        nativeLanguageId: ENGLISH,
        targetLanguageId: SPANISH,
      });
      const [stored] = await db
        .select()
        .from(user)
        .where(eq(user.id, context.userId));
      expect(stored.onBoardingComplete).toBe(true);
      expect(response.body).toEqual({ success: true });
    } else if (endpoint.kind === 'sync') {
      expect((response.body as { rejected?: unknown }).rejected ?? {}).toEqual(
        {},
      );
      const stored = await db.execute<{
        title: string;
        description: string;
        fields_json: string;
        additional_content: string;
        front: string;
        back: string;
      }>(sql`
        select d.title, d.description, n.fields_json, n.additional_content, c.front, c.back
        from user_decks d join user_note_decks m on m.deck_id = d.id
          join user_notes n on n.id = m.note_id join user_cards c on c.note_id = n.id
        where d.id = 'corpus-deck' and d.user_id = ${context.userId}
      `);
      expect(stored.rows).toEqual([
        {
          title: text,
          description: text,
          fields_json: JSON.stringify({ front: text, back: text }),
          additional_content: text,
          front: text,
          back: text,
        },
      ]);
      const [profile] = await db.select().from(userProfiles);
      expect(profile.bio).toBe(text);
      const pull = await request(app.getHttpServer())
        .post('/sync/pull')
        .set('Cookie', cookie)
        .send({ cursor: null, schemaVersion: 1, migration: null })
        .expect(200);
      const changes = (
        pull.body as { changes: ReturnType<typeof contentChanges> }
      ).changes;
      expect([
        ...changes.user_decks.created,
        ...changes.user_decks.updated,
      ]).toContainEqual(
        expect.objectContaining({
          id: 'corpus-deck',
          title: text,
          description: text,
        }),
      );
      expect([
        ...changes.user_notes.created,
        ...changes.user_notes.updated,
      ]).toContainEqual(
        expect.objectContaining({
          fields_json: JSON.stringify({ front: text, back: text }),
          additional_content: text,
        }),
      );
      expect([
        ...changes.user_cards.created,
        ...changes.user_cards.updated,
      ]).toContainEqual(expect.objectContaining({ front: text, back: text }));
      const profiles = (
        pull.body as {
          changes: {
            user_profiles: { created: unknown[]; updated: unknown[] };
          };
        }
      ).changes.user_profiles;
      expect([...profiles.created, ...profiles.updated]).toContainEqual(
        expect.objectContaining({ id: context.userId, bio: text }),
      );
    } else if (endpoint.kind === 'update-user') {
      const [stored] = await db
        .select()
        .from(user)
        .where(eq(user.id, context.userId));
      expect(stored.name).toBe(text);
      expect(stored.timezone).toBe('UTC');
      expect(stored.onBoardingComplete).toBe(false);
      expect(stored.id).not.toBe(unknownFields.userId);
      expect(response.body).toEqual({ status: true });
      const session = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Cookie', cookie)
        .expect(200);
      expect(session.body).toMatchObject({
        user: { id: context.userId, name: text, onBoardingComplete: false },
      });
    } else if (endpoint.kind === 'report' || endpoint.kind === 'takedown') {
      const [stored] =
        endpoint.kind === 'report'
          ? await db.select().from(deckReports)
          : await db.select().from(deckTakedowns);
      expect(stored).toMatchObject({ deckId: sharedDeckId, reason: text });
      if (endpoint.kind === 'report') {
        expect(stored).toMatchObject({ reporterUserId: context.userId });
        expect(response.body).toMatchObject({ report: { reason: text } });
      } else {
        expect(stored).toMatchObject({ source: 'operator' });
        expect(response.body).toEqual({ status: 'blocked' });
        const [deck] = await db
          .select()
          .from(userDecks)
          .where(eq(userDecks.id, sharedDeckId));
        expect(deck.visibility).toBe('private');
      }
      const fetched = await request(app.getHttpServer())
        .get('/api/operator/deck-reports')
        .set('x-moderation-operator-key', operatorKey)
        .expect(200);
      if (endpoint.kind === 'report') {
        expect(fetched.body).toMatchObject({ reports: [{ reason: text }] });
      } else {
        const status = await request(app.getHttpServer())
          .get(`/api/decks/${sharedDeckId}/moderation`)
          .set('Cookie', cookie)
          .expect(200);
        expect(status.body).toMatchObject({ status: 'blocked', reason: text });
      }
    } else if (endpoint.kind === 'explain') {
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      const events = response.text
        .split('\n\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) =>
          moderationExplanationEventSchema.parse(JSON.parse(line.slice(6))),
        );
      expect(events.at(-1)?.type).toBe('result');
      expect(generateText).toHaveBeenCalledOnce();
      expect(generateText.mock.calls[0][1]).toBe(
        `Category: ${text}\nFront: Front\nBack: Back`,
      );
      const [snapshot] = await db.select().from(publishedDecks);
      expect(snapshot.moderationVerdict?.warnings).toContainEqual({
        cardId: sharedCardId,
        reason: text,
      });
    } else {
      const [job] = await db.select().from(aiGenerationJobs);
      expect(job.userId).toBe(context.userId);
      const expected =
        job.type === 'topic_deck'
          ? { topic: text, count: 1 }
          : job.type === 'text_cards'
            ? { sourceText: text, count: 1 }
            : { word: text, deckId: 'corpus-word-deck', direction: 'target' };
      expect(job.payload).toMatchObject(expected);
      expect(job.payload).not.toHaveProperty('unexpected');
      expect(job.payload).not.toHaveProperty('userId');
      if (endpoint.kind === 'playground') {
        expect(response.headers['content-type']).toMatch(/text\/event-stream/);
        const events = response.text
          .split('\n\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) =>
            aiPlaygroundEventSchema.parse(JSON.parse(line.slice(6))),
          );
        expect(events.at(-1)?.type).toBe('result');
        expect(job.status).toBe('completed');
      } else {
        expect(
          aiJobResponseSchema.parse(response.body).job.payload,
        ).toMatchObject(expected);
        expect(job.status).toBe('pending');
      }
      const fetched = await request(app.getHttpServer())
        .get(`/api/ai/jobs/${job.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(aiJobResponseSchema.parse(fetched.body).job.payload).toMatchObject(
        expected,
      );
    }
  }

  for (const endpoint of endpoints) {
    describe(endpoint.name, () => {
      it.each(corpus)('$name', async (testCase) => {
        await prepareEndpoint(endpoint);
        const before = await snapshot();
        const req = request(app.getHttpServer())
          .post(endpoint.path)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .set('Content-Type', 'application/json');
        if (endpoint.kind === 'takedown') {
          req.set('x-moderation-operator-key', operatorKey);
        }
        const body = testCase.body(endpoint, context);
        const response = await (body === undefined ? req : req.send(body));
        const status = testCase.status(endpoint);
        if (status >= 400) {
          expectJsonError(response, status);
          expect(await snapshot()).toEqual(before);
        } else {
          expect(response.status).toBe(status);
          await expectAccepted(endpoint, response, testCase.text!);
        }
      });
    });
  }

  const additionalInvalidFields = endpoints.flatMap((endpoint) => {
    const patches: Record<string, unknown>[] =
      endpoint.kind === 'report' || endpoint.kind === 'takedown'
        ? [{ reason: ' ' }, { reason: 'x'.repeat(2001) }]
        : endpoint.kind === 'explain'
          ? [
              { cardId: [] },
              { reason: {} },
              { reason: ' ' },
              { reason: 'x'.repeat(501) },
              { source: 42 },
              { source: injections[1] },
            ]
          : endpoint.kind === 'update-user'
            ? [{ name: 42 }, { name: null }, { image: {} }, { timezone: [] }]
            : [];
    return patches.map((patch) => ({
      endpoint,
      patch,
      name: `${endpoint.name}: ${JSON.stringify(patch).slice(0, 80)}`,
    }));
  });
  it.each(additionalInvalidFields)(
    '$name leaves the database unchanged',
    async ({ endpoint, patch }) => {
      await prepareEndpoint(endpoint);
      const before = await snapshot();
      const req = request(app.getHttpServer())
        .post(endpoint.path)
        .set('Origin', origin)
        .set('Cookie', cookie);
      if (endpoint.kind === 'takedown') {
        req.set('x-moderation-operator-key', operatorKey);
      }
      const response = await req.send({
        ...endpoint.valid(context, 'corpus_user'),
        ...patch,
      });
      expectJsonError(response, 400);
      expect(await snapshot()).toEqual(before);
      expect(generateText).not.toHaveBeenCalled();
    },
  );

  it.each(injections)(
    'moderation explanation rejects an unrecognized card id: %s',
    async (text) => {
      const endpoint = endpoints.find(({ kind }) => kind === 'explain')!;
      await prepareEndpoint(endpoint);
      const before = await snapshot();
      const response = await request(app.getHttpServer())
        .post(endpoint.path)
        .set('Cookie', cookie)
        .send({ ...endpoint.valid(context, 'corpus_user'), cardId: text });
      expectJsonError(response, 404);
      expect(await snapshot()).toEqual(before);
      expect(generateText).not.toHaveBeenCalled();
    },
  );

  it.each(
    endpoints
      .filter(({ kind }) =>
        ['update-user', 'report', 'takedown', 'explain'].includes(kind),
      )
      .map((endpoint) => ({ endpoint, name: endpoint.name })),
  )('$name requires authentication', async ({ endpoint }) => {
    await prepareEndpoint(endpoint);
    const before = await snapshot();
    const response = await request(app.getHttpServer())
      .post(endpoint.path)
      .set('Origin', origin)
      .send(endpoint.valid(context, 'corpus_user'));
    expectJsonError(response, 401);
    expect(await snapshot()).toEqual(before);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('operator takedown rejects an incorrect operator key', async () => {
    const endpoint = endpoints.find(({ kind }) => kind === 'takedown')!;
    await prepareEndpoint(endpoint);
    const before = await snapshot();
    const response = await request(app.getHttpServer())
      .post(endpoint.path)
      .set('Cookie', cookie)
      .set('x-moderation-operator-key', 'incorrect-key')
      .send(endpoint.valid(context, 'corpus_user'));
    expectJsonError(response, 401);
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    { patch: { name: 'Updated Name', unexpected: injections[0] } },
    { patch: { timezone: 'Europe/Berlin' } },
    { patch: { image: 'https://example.test/avatar.png' } },
    { patch: { image: null } },
  ])('update user accepts partial fields: $patch', async ({ patch }) => {
    // Clearing an image should update a previously populated value.
    await db
      .update(user)
      .set({ image: 'https://example.test/previous.png' })
      .where(eq(user.id, context.userId));
    await request(app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send(patch)
      .expect(200);
    const expected = Object.fromEntries(
      Object.entries(patch).filter(([field]) => field !== 'unexpected'),
    );
    const [stored] = await db
      .select()
      .from(user)
      .where(eq(user.id, context.userId));
    expect(stored).toMatchObject(expected);
    const fetched = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookie)
      .expect(200);
    expect(fetched.body).toMatchObject({ user: expected });
    expect(stored.onBoardingComplete).toBe(false);
  });

  it.each([
    {
      name: 'overlong signup password',
      path: '/api/auth/sign-up/email',
      body: () => ({
        email: 'too-long@example.test',
        name: 'Too Long',
        password: password.repeat(10),
      }),
    },
    {
      name: 'invalid onboarding language id',
      path: '/api/auth/onboard',
      body: () => ({
        username: 'corpus_user',
        native_language_id: "' OR 1=1 --",
        target_language_id: SPANISH,
      }),
    },
    {
      name: 'identical onboarding languages',
      path: '/api/auth/onboard',
      body: () => ({
        username: 'corpus_user',
        native_language_id: ENGLISH,
        target_language_id: ENGLISH,
      }),
    },
    {
      name: 'overlong AI topic',
      path: '/api/ai/generate',
      body: () => ({ type: 'topic_deck', topic: 'x'.repeat(301) }),
    },
    {
      name: 'overlong AI source text',
      path: '/api/ai/generate',
      body: () => ({ type: 'text_cards', sourceText: 'x'.repeat(10001) }),
    },
    {
      name: 'overlong AI word',
      path: '/api/ai/generate',
      body: () => ({
        type: 'word_note',
        deckId: 'corpus-word-deck',
        word: 'x'.repeat(101),
        direction: 'target',
      }),
    },
    {
      name: 'invalid AI count',
      path: '/api/ai/generate',
      body: () => ({ type: 'topic_deck', topic: 'Valid topic', count: 21 }),
    },
    {
      name: 'invalid AI model',
      path: '/api/ai/generate',
      body: () => ({
        type: 'topic_deck',
        topic: 'Valid topic',
        model: "' OR 1=1 --",
      }),
    },
    {
      name: 'unknown sync table after valid changes',
      path: '/sync/push',
      body: () => ({
        cursor: context.cursor,
        changes: {
          ...contentChanges('Must roll back'),
          unexpected: { created: [], updated: [], deleted: [] },
        },
      }),
    },
    {
      name: 'missing sync row id after valid changes',
      path: '/sync/push',
      body: () => ({
        cursor: context.cursor,
        changes: {
          ...contentChanges('Must roll back'),
          user_profiles: { created: [{}], updated: [], deleted: [] },
        },
      }),
    },
  ])('$name leaves the database unchanged', async ({ path, body }) => {
    const before = await snapshot();
    const response = await request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send(body());
    expectJsonError(response, 400);
    expect(await snapshot()).toEqual(before);
  });

  // Sync row validation uses the existing HTTP-200 `rejected` protocol. Keep
  // that contract while checking invalid content never reaches storage.
  it.each([
    { name: 'wrong-typed deck title', patch: { title: 42 } },
    { name: 'unknown deck field', patch: { unexpected: injections[0] } },
  ])('sync rejects $name without persisting a row', async ({ patch }) => {
    const before = await snapshot();
    const changes = contentChanges('Rejected deck');
    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', cookie)
      .send({
        cursor: context.cursor,
        changes: {
          user_decks: {
            created: [{ ...changes.user_decks.created[0], ...patch }],
            updated: [],
            deleted: [],
          },
        },
      })
      .expect(200);
    expect(response.body).toMatchObject({
      rejected: { user_decks: ['corpus-deck'] },
    });
    expect(await snapshot()).toEqual(before);
  });
  it.each(
    ['avatar_file_id', 'native_language_id', 'target_language_id'].flatMap(
      (field) => injections.map((text) => ({ field, text })),
    ),
  )(
    'sync rejects injection in profile $field: $text',
    async ({ field, text }) => {
      const before = await snapshot();
      const response = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Cookie', cookie)
        .send({
          cursor: context.cursor,
          changes: {
            user_profiles: {
              created: [
                { ...profileRow(context.userId, 'Unchanged'), [field]: text },
              ],
              updated: [],
              deleted: [],
            },
          },
        })
        .expect(200);
      expect(response.body).toMatchObject({
        rejected: { user_profiles: [context.userId] },
      });
      expect(await snapshot()).toEqual(before);
    },
  );
});
