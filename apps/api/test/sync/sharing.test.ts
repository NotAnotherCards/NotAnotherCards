import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  WORD_NOTE_TYPE,
  cardId,
  compileNote,
  noteDeckId,
} from '@repo/offline-db';
import {
  ENGLISH,
  GERMAN,
  moderationRefusalSchema,
  publishResponseSchema,
  sharedDeckListSchema,
  sharedDeckPreviewSchema,
  sharedDeckImportSchema,
  operatorCapabilitiesSchema,
  operatorReportPageSchema,
  operatorDeckReviewSchema,
  operatorTakedownResponseSchema,
  operatorTakedownErrorSchema,
} from '@repo/schemas';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { asc, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../../src/app.module';
import { DATABASE_CONNECTION } from '../../src/database/database-connection';
import { ModerationService } from '../../src/sharing/moderation.service';
import { SharingService } from '../../src/sharing/sharing.service';
import { user } from '../../src/database/schema';
import {
  deckReports,
  deckTakedowns,
  publishedDecks,
} from '../../src/sharing/schema';
import { aiGenerationJobs } from '../../src/ai/schema';
import { AiWorkerService } from '../../src/ai/ai-worker.service';
import { syncScopeLockKey } from '../../src/sync/sync-store';
import {
  userCards,
  userDecks,
  userNoteDecks,
  userNotes,
  userProfiles,
} from '../../src/sync/schema';
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

const deckWire = (
  id: string,
  visibility = 'private',
  title = `Deck ${id}`,
) => ({
  id,
  title,
  description: 'A deck',
  note_type: BASIC_NOTE_TYPE,
  native_language_id: null,
  target_language_id: null,
  visibility,
  created_at: 1,
  updated_at: 1,
});

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('deck sharing endpoints', () => {
  let app: INestApplication<App>;
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;
  let twoFactorAdmin: TestUser;
  let deletionAdmin: TestUser;

  const previousEnvironment = {
    databaseUrl: process.env.DATABASE_URL,
    frontendUrl: process.env.FRONTEND_URL,
    authSecret: process.env.BETTER_AUTH_SECRET,
    authUrl: process.env.BETTER_AUTH_URL,
    moderationAllowAll: process.env.MODERATION_ALLOW_ALL,
    operatorKey: process.env.MODERATION_OPERATOR_KEY,
    adminUserIds: process.env.MODERATION_ADMIN_USER_IDS,
    workerEnabled: process.env.AI_WORKER_ENABLED,
    maxDailyReports: process.env.MODERATION_MAX_DAILY_REPORTS_PER_USER,
  };

  const signUp = async (label: string): Promise<TestUser> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: `${label}@example.test`,
        password: 'SharingPassword123!',
        name: `Sharing ${label}`,
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

  /**
   * A deck with `cards` notes, each carrying one card, written straight to
   * the tables the push endpoint would have written. Card n reads
   * "front n" / "back n" and sorts after card n-1.
   */
  const seedDeck = async (
    owner: TestUser,
    deckId: string,
    options: {
      cards?: number;
      visibility?: string;
      deleted?: boolean;
      title?: string;
      updatedAt?: number;
      /** A word deck carries a language pair; the CHECK requires both. */
      languages?: { native: string; target: string };
    } = {},
  ) => {
    const { cards = 1, visibility = 'private', deleted = false } = options;
    const now = options.updatedAt ?? Date.now();
    const noteIds = Array.from(
      { length: cards },
      (_, index) => `${deckId}-note-${index}`,
    );

    await db.insert(userDecks).values({
      id: deckId,
      rev: sql`nextval('remelon_rev')`,
      deletedAt: deleted ? new Date() : null,
      userId: owner.id,
      title: options.title ?? `Deck ${deckId}`,
      description: 'A deck',
      noteType: options.languages ? WORD_NOTE_TYPE : BASIC_NOTE_TYPE,
      nativeLanguageId: options.languages?.native ?? null,
      targetLanguageId: options.languages?.target ?? null,
      visibility,
      createdAt: now,
      updatedAt: now,
    });
    if (cards === 0) return { deckId, noteIds, cardIds: [] };

    const compiled = noteIds.map((_, index) =>
      compileNote(
        options.languages ? WORD_NOTE_TYPE : BASIC_NOTE_TYPE,
        BASIC_NOTE_FIELDS_VERSION,
        options.languages
          ? {
              word: `front ${index}`,
              translation: `back ${index}`,
              native_language_id: options.languages.native,
              target_language_id: options.languages.target,
              image: 'private-image-id',
              word_audio: 'private-audio-id',
            }
          : { front: `front ${index}`, back: `back ${index}` },
      ),
    );

    await db.insert(userNotes).values(
      noteIds.map((noteId, index) => ({
        id: noteId,
        rev: sql`nextval('remelon_rev')`,
        userId: owner.id,
        noteType: options.languages ? WORD_NOTE_TYPE : BASIC_NOTE_TYPE,
        fieldsVersion: BASIC_NOTE_FIELDS_VERSION,
        fieldsJson: compiled[index].fieldsJson,
        additionalContent: null,
        createdAt: now + index,
        updatedAt: now + index,
      })),
    );
    await db.insert(userCards).values(
      noteIds.flatMap((noteId, index) =>
        compiled[index].cards.map((card) => ({
          id: cardId(noteId, card.templateKey),
          rev: sql`nextval('remelon_rev')`,
          userId: owner.id,
          noteId,
          templateKey: card.templateKey,
          front: card.front,
          back: card.back,
          dueAt: now,
          createdAt: now + index,
          updatedAt: now + index,
        })),
      ),
    );
    await db.insert(userNoteDecks).values(
      noteIds.map((noteId, index) => ({
        id: noteDeckId(noteId, deckId),
        rev: sql`nextval('remelon_rev')`,
        userId: owner.id,
        noteId,
        deckId,
        createdAt: now + index,
        updatedAt: now + index,
      })),
    );

    if (visibility === 'public' && !deleted) {
      await app.get(SharingService).publish(owner.id, deckId);
      await db
        .update(publishedDecks)
        .set({ publishedAt: new Date(now) })
        .where(eq(publishedDecks.deckId, deckId));
    }
    return {
      deckId,
      noteIds,
      cardIds: noteIds.flatMap((noteId, index) =>
        compiled[index].cards.map((card) => cardId(noteId, card.templateKey)),
      ),
    };
  };

  const storedDeck = async (deckId: string) =>
    (await db.select().from(userDecks).where(eq(userDecks.id, deckId)))[0];

  const storedPublication = async (deckId: string) =>
    (
      await db
        .select()
        .from(publishedDecks)
        .where(eq(publishedDecks.deckId, deckId))
    )[0];

  const takedown = (
    admin: TestUser,
    deckId: string,
    expectedPublishedAt: string,
  ) =>
    post(admin, `/api/operator/decks/${deckId}/takedown`)
      .set('Origin', 'http://localhost:5173')
      .send({ reason: 'Reviewed complaint.', expectedPublishedAt });

  const post = (user: TestUser, path: string) =>
    request(app.getHttpServer()).post(path).set('Cookie', user.cookie);

  const get = (user: TestUser, path: string) =>
    request(app.getHttpServer()).get(path).set('Cookie', user.cookie);

  const responseCookies = (response: request.Response) => {
    const header = response.headers['set-cookie'] as
      string[] | string | undefined;
    return (Array.isArray(header) ? header : header ? [header] : [])
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
  };

  const browse = async (user: TestUser, query = '') => {
    const response = await get(user, `/api/shared/decks${query}`).expect(200);
    // Parsing every listing keeps the wire types the web (#289) reads honest.
    sharedDeckListSchema.parse(response.body);
    return (response.body as { decks: { id: string }[] }).decks;
  };

  const pull = async (user: TestUser, cursor: string | null = null) => {
    const response = await request(app.getHttpServer())
      .post('/sync/pull')
      .set('Cookie', user.cookie)
      .send(pullBody(cursor))
      .expect(200);
    return response.body as {
      cursor: string;
      changes: Record<
        string,
        { created: unknown[]; updated: unknown[]; deleted: string[] }
      >;
    };
  };

  const createApp = async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(db)
      .compile();
    const instance = moduleFixture.createNestApplication<INestApplication<App>>(
      { logger: false },
    );
    await instance.init();
    return instance;
  };

  beforeAll(async () => {
    await setUpPostgres();
    process.env.DATABASE_URL = getTestConnectionString();
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.MODERATION_ALLOW_ALL = '1';
    process.env.MODERATION_OPERATOR_KEY = 'test-operator-key';
    process.env.MODERATION_ADMIN_USER_IDS = '';
    process.env.AI_WORKER_ENABLED = 'false';
    process.env.MODERATION_MAX_DAILY_REPORTS_PER_USER = '10';

    app = await createApp();

    userA = await signUp('sharing-user-a');
    userB = await signUp('sharing-user-b');
    userC = await signUp('sharing-user-c');
    twoFactorAdmin = await signUp('sharing-2fa-admin');
    deletionAdmin = await signUp('sharing-deletion-admin');
    await app.close();
    // Recreate the API with existing account IDs, as configuration changes require.
    process.env.MODERATION_ADMIN_USER_IDS = ` , ${userB.id}, ${twoFactorAdmin.id}, ${deletionAdmin.id}, ${userB.id}, `;
    app = await createApp();
  }, 30_000);

  beforeEach(async () => {
    await db.execute(`
      truncate table daily_challenge_completions, badge_awards, deck_takedowns, deck_reports, published_decks, user_profiles, review_events, user_note_decks, user_cards, user_notes, user_decks, ai_generation_jobs, ai_usage cascade;
      delete from remelon_revision_checkpoints;
      delete from remelon_sync_meta;
      alter sequence remelon_rev restart with 1;
    `);
    const now = Date.now();
    await db.insert(userProfiles).values([
      {
        userId: userA.id,
        rev: sql`nextval('remelon_rev')`,
        username: 'user-a',
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: userB.id,
        rev: sql`nextval('remelon_rev')`,
        username: 'user-b',
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: userC.id,
        rev: sql`nextval('remelon_rev')`,
        username: 'user-c',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.MODERATION_ALLOW_ALL = '1';
    process.env.MODERATION_MAX_DAILY_REPORTS_PER_USER = '10';
  });

  afterAll(async () => {
    await app?.close();
    await tearDownPostgres();

    process.env.DATABASE_URL = previousEnvironment.databaseUrl;
    process.env.FRONTEND_URL = previousEnvironment.frontendUrl;
    process.env.BETTER_AUTH_SECRET = previousEnvironment.authSecret;
    process.env.BETTER_AUTH_URL = previousEnvironment.authUrl;
    process.env.MODERATION_ALLOW_ALL = previousEnvironment.moderationAllowAll;
    process.env.MODERATION_OPERATOR_KEY = previousEnvironment.operatorKey;
    if (previousEnvironment.adminUserIds === undefined)
      delete process.env.MODERATION_ADMIN_USER_IDS;
    else
      process.env.MODERATION_ADMIN_USER_IDS = previousEnvironment.adminUserIds;
    process.env.AI_WORKER_ENABLED = previousEnvironment.workerEnabled;
    process.env.MODERATION_MAX_DAILY_REPORTS_PER_USER =
      previousEnvironment.maxDailyReports;
  }, 30_000);

  it('rejects unauthenticated publish and unpublish', async () => {
    await seedDeck(userA, 'anon-deck');
    await request(app.getHttpServer())
      .post('/api/decks/anon-deck/publish')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/decks/anon-deck/unpublish')
      .expect(401);
    expect((await storedDeck('anon-deck')).visibility).toBe('private');
  });

  it('publishes with a fresh revision the owner pulls, and republishes', async () => {
    await seedDeck(userA, 'publishable');
    const before = await storedDeck('publishable');
    const start = await pull(userA);

    const response = await post(userA, '/api/decks/publishable/publish').expect(
      200,
    );
    expect(response.body).toEqual({ visibility: 'public', warnings: [] });
    publishResponseSchema.parse(response.body);

    const published = await storedDeck('publishable');
    expect(published.visibility).toBe('public');
    expect(published.rev).toBeGreaterThan(before.rev);

    const changes = (await pull(userA, start.cursor)).changes.user_decks;
    expect([...changes.created, ...changes.updated]).toEqual([
      expect.objectContaining({ id: 'publishable', visibility: 'public' }),
    ]);

    await post(userA, '/api/decks/publishable/publish').expect(200);
    expect((await storedDeck('publishable')).rev).toBeGreaterThan(
      published.rev,
    );
    expect(await db.select().from(publishedDecks)).toHaveLength(1);
  });

  it('refuses a deck the moderator flags and names the offending card', async () => {
    const { cardIds } = await seedDeck(userA, 'flagged', { cards: 2 });
    const before = await storedDeck('flagged');
    const check = vi
      .spyOn(app.get(ModerationService), 'check')
      .mockResolvedValue({
        ok: false,
        flagged: [{ cardId: cardIds[1], reason: 'slur' }],
        warnings: [],
        results: [],
      });

    const response = await post(userA, '/api/decks/flagged/publish').expect(
      422,
    );
    expect(response.body).toEqual({
      flagged: [{ cardId: cardIds[1], reason: 'slur' }],
    });
    moderationRefusalSchema.parse(response.body);

    expect(check).toHaveBeenCalledWith({
      deckId: 'flagged',
      cards: [
        { id: cardIds[0], front: 'front 0', back: 'back 0' },
        { id: cardIds[1], front: 'front 1', back: 'back 1' },
      ],
    });
    expect(await storedDeck('flagged')).toEqual(before);
  });

  it('publishes with moderation warnings in the response', async () => {
    const { cardIds } = await seedDeck(userA, 'warned');
    vi.spyOn(app.get(ModerationService), 'check').mockResolvedValue({
      ok: true,
      flagged: [],
      warnings: [{ cardId: cardIds[0], reason: 'Violent' }],
      results: [],
    });

    const response = await post(userA, '/api/decks/warned/publish').expect(200);
    expect(response.body).toEqual({
      visibility: 'public',
      warnings: [{ cardId: cardIds[0], reason: 'Violent' }],
    });
    publishResponseSchema.parse(response.body);
    expect((await storedDeck('warned')).visibility).toBe('public');

    await get(userA, '/api/decks/warned/moderation')
      .expect(200)
      .expect({
        status: 'visible',
        warnings: [{ cardId: cardIds[0], reason: 'Violent' }],
      });

    const explanation = await post(
      userA,
      '/api/decks/warned/moderation/explain',
    )
      .send({
        cardId: cardIds[0],
        reason: 'Violent',
        source: 'published',
      })
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);
    expect(explanation.text).toContain('"type":"delta"');
    expect(explanation.text).toContain('"type":"result"');

    await post(userA, '/api/decks/warned/moderation/explain')
      .send({
        cardId: cardIds[0],
        reason: 'Invented category',
        source: 'published',
      })
      .expect(404);

    await post(userB, '/api/decks/warned/moderation/explain')
      .send({
        cardId: cardIds[0],
        reason: 'Violent',
        source: 'published',
      })
      .expect(404);
  });

  it('refuses to publish where moderation is not switched on', async () => {
    await seedDeck(userA, 'unchecked');
    const before = await storedDeck('unchecked');
    const config = app.get(ConfigService);
    const getSpy = vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'MODERATION_ALLOW_ALL' || key === 'AI_API_BASE')
        return undefined;
      return process.env[key as string];
    });

    const response = await post(userA, '/api/decks/unchecked/publish').expect(
      422,
    );
    expect(response.body).toEqual({
      reason: 'moderation unavailable',
      flagged: [],
    });
    expect(await storedDeck('unchecked')).toEqual(before);
    getSpy.mockRestore();
  });

  it('answers 404 for someone else’s deck and for a tombstoned one', async () => {
    await seedDeck(userA, 'not-yours');
    await seedDeck(userA, 'tombstoned', { deleted: true });

    await post(userB, '/api/decks/not-yours/publish').expect(404);
    await post(userB, '/api/decks/not-yours/unpublish').expect(404);
    await post(userA, '/api/decks/tombstoned/publish').expect(404);
    await post(userA, '/api/decks/missing-entirely/publish').expect(404);

    expect((await storedDeck('not-yours')).visibility).toBe('private');
  });

  it('unpublishes with a fresh revision and leaves an already private deck alone', async () => {
    await seedDeck(userA, 'retractable', { visibility: 'public' });
    const before = await storedDeck('retractable');

    expect(
      (await post(userA, '/api/decks/retractable/unpublish').expect(200)).body,
    ).toEqual({ visibility: 'private' });
    const retracted = await storedDeck('retractable');
    expect(retracted.visibility).toBe('private');
    expect(retracted.rev).toBeGreaterThan(before.rev);

    await post(userA, '/api/decks/retractable/unpublish').expect(200);
    expect((await storedDeck('retractable')).rev).toBe(retracted.rev);
    expect(await db.select().from(publishedDecks)).toEqual([]);
    await post(userA, '/api/decks/retractable/publish').expect(200);
    expect(await db.select().from(publishedDecks)).toHaveLength(1);
  });

  it('records one report per user and queues one re-check without hiding the deck', async () => {
    await seedDeck(userA, 'reported', { visibility: 'public' });

    const response = await post(userB, '/api/shared/decks/reported/report')
      .send({ reason: 'The answer contains harassment.' })
      .expect(201);

    expect(response.body).toMatchObject({
      report: {
        deckId: 'reported',
        reporterUserId: userB.id,
        reason: 'The answer contains harassment.',
      },
      recheck: 'queued',
    });
    expect(await db.select().from(deckReports)).toHaveLength(1);
    expect(await db.select().from(aiGenerationJobs)).toEqual([
      expect.objectContaining({
        type: 'deck_moderation',
        status: 'pending',
      }),
    ]);
    expect((await browse(userB)).map(({ id }) => id)).toContain('reported');

    const pending = await post(userC, '/api/shared/decks/reported/report')
      .send({ reason: 'A separate report while the check is queued.' })
      .expect(201);
    expect((pending.body as { recheck: string }).recheck).toBe('pending');
    expect(await db.select().from(aiGenerationJobs)).toHaveLength(1);

    await post(userB, '/api/shared/decks/reported/report')
      .send({ reason: 'A second report' })
      .expect(409);
    await post(userA, '/api/shared/decks/reported/report')
      .send({ reason: 'Reporting my own deck' })
      .expect(400);
  });

  it('enforces the reporter daily cap before recording or queuing', async () => {
    process.env.MODERATION_MAX_DAILY_REPORTS_PER_USER = '1';
    await seedDeck(userA, 'first-report', { visibility: 'public' });
    await seedDeck(userA, 'over-report-cap', { visibility: 'public' });

    await post(userB, '/api/shared/decks/first-report/report')
      .send({ reason: 'First legitimate report.' })
      .expect(201);
    await post(userB, '/api/shared/decks/over-report-cap/report')
      .send({ reason: 'This one exceeds the daily cap.' })
      .expect(429);

    expect(await db.select().from(deckReports)).toHaveLength(1);
    expect(await db.select().from(aiGenerationJobs)).toHaveLength(1);
  });

  it('caches a clean thorough re-check of the same published snapshot', async () => {
    await seedDeck(userA, 'clean-report', { visibility: 'public' });
    await post(userB, '/api/shared/decks/clean-report/report')
      .send({ reason: 'Please double-check this.' })
      .expect(201);
    const check = vi
      .spyOn(app.get(ModerationService), 'checkThorough')
      .mockResolvedValue({ ok: true, flagged: [], warnings: [], results: [] });

    expect(await app.get(AiWorkerService).processNextJob()).toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
    const cached = await post(userC, '/api/shared/decks/clean-report/report')
      .send({ reason: 'I am not sure this is accurate.' })
      .expect(201);
    expect((cached.body as { recheck: string }).recheck).toBe('cached');
    expect(check).toHaveBeenCalledTimes(1);
    expect(await db.select().from(aiGenerationJobs)).toHaveLength(1);
  });

  it('automatically takes down a snapshot either thorough classifier flags', async () => {
    await seedDeck(userA, 'auto-blocked', { visibility: 'public' });
    const imported = await post(
      userC,
      '/api/shared/decks/auto-blocked/import',
    ).expect(201);
    await post(userB, '/api/shared/decks/auto-blocked/report')
      .send({ reason: 'This contains targeted abuse.' })
      .expect(201);
    vi.spyOn(app.get(ModerationService), 'checkThorough').mockResolvedValue({
      ok: false,
      flagged: [
        {
          cardId: 'flagged-card',
          reason: 'Harassment',
          classifier: 'moderation-thorough',
        },
      ],
      warnings: [],
      results: [
        {
          cardId: 'flagged-card',
          classifier: 'moderation',
          verdict: 'safe',
          categories: [],
        },
        {
          cardId: 'flagged-card',
          classifier: 'moderation-thorough',
          verdict: 'unsafe',
          categories: null,
        },
      ],
    });

    expect(await app.get(AiWorkerService).processNextJob()).toBe(true);
    expect((await storedDeck('auto-blocked')).visibility).toBe('private');
    expect(await browse(userB)).toEqual([]);
    await get(userB, '/api/shared/decks/auto-blocked').expect(404);
    await post(userB, '/api/shared/decks/auto-blocked/import').expect(404);
    // Copy-on-import means a takedown cannot reach an existing personal copy.
    const importedId = (imported.body as { deckId: string }).deckId;
    expect(await storedDeck(importedId)).toEqual(
      expect.objectContaining({ userId: userC.id, visibility: 'private' }),
    );
    const [takedown] = await db.select().from(deckTakedowns);
    expect(takedown).toEqual(
      expect.objectContaining({
        deckId: 'auto-blocked',
        source: 'automatic',
        operatorUserId: null,
      }),
    );
    expect(takedown.verdict.results).toEqual([
      {
        cardId: 'flagged-card',
        classifier: 'moderation',
        verdict: 'safe',
        categories: [],
      },
      {
        cardId: 'flagged-card',
        classifier: 'moderation-thorough',
        verdict: 'unsafe',
        categories: null,
      },
    ]);

    const status = await get(
      userA,
      '/api/decks/auto-blocked/moderation',
    ).expect(200);
    expect(status.body).toMatchObject({
      status: 'blocked',
      flagged: [
        {
          cardId: 'flagged-card',
          reason: 'Harassment',
          classifier: 'moderation-thorough',
        },
      ],
      results: [
        expect.objectContaining({
          classifier: 'moderation',
          verdict: 'safe',
          categories: [],
        }),
        expect.objectContaining({
          classifier: 'moderation-thorough',
          verdict: 'unsafe',
          categories: null,
        }),
      ],
    });
  });

  it('never applies a report check to a newer republished snapshot', async () => {
    await seedDeck(userA, 'republished-before-check', {
      visibility: 'public',
    });
    await post(userB, '/api/shared/decks/republished-before-check/report')
      .send({ reason: 'This old version needs review.' })
      .expect(201);
    await post(userA, '/api/decks/republished-before-check/publish').expect(
      200,
    );
    const check = vi.spyOn(app.get(ModerationService), 'checkThorough');

    expect(await app.get(AiWorkerService).processNextJob()).toBe(true);
    expect(check).not.toHaveBeenCalled();
    expect((await storedDeck('republished-before-check')).visibility).toBe(
      'public',
    );
    expect(await db.select().from(deckTakedowns)).toEqual([]);
    expect(await browse(userB)).toHaveLength(1);
  });

  it('carries a newer-snapshot report forward when the active job is stale', async () => {
    await seedDeck(userA, 'reported-twice-around-republish', {
      visibility: 'public',
    });
    await post(
      userB,
      '/api/shared/decks/reported-twice-around-republish/report',
    )
      .send({ reason: 'Problem in the first snapshot.' })
      .expect(201);
    await post(
      userA,
      '/api/decks/reported-twice-around-republish/publish',
    ).expect(200);
    const newerReport = await post(
      userC,
      '/api/shared/decks/reported-twice-around-republish/report',
    )
      .send({ reason: 'The republished snapshot still has a problem.' })
      .expect(201);
    expect((newerReport.body as { recheck: string }).recheck).toBe('pending');
    const check = vi
      .spyOn(app.get(ModerationService), 'checkThorough')
      .mockResolvedValue({
        ok: false,
        flagged: [{ cardId: 'new-card', reason: 'Harassment' }],
        warnings: [],
        results: [],
      });

    // The old job is completed as stale and atomically replaced by one for
    // the snapshot the second reporter actually saw.
    expect(await app.get(AiWorkerService).processNextJob()).toBe(true);
    expect(check).not.toHaveBeenCalled();
    const pendingJobs = (await db.select().from(aiGenerationJobs)).filter(
      ({ status }) => status === 'pending',
    );
    expect(pendingJobs).toHaveLength(1);
    expect(pendingJobs[0].nextRunAt.getTime()).toBeLessThanOrEqual(Date.now());

    expect(await app.get(AiWorkerService).processNextJob()).toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
    expect(
      (await storedDeck('reported-twice-around-republish')).visibility,
    ).toBe('private');
  });

  it('keeps the independent operator-key CLI path with a null actor', async () => {
    await seedDeck(userA, 'operator-blocked', { visibility: 'public' });
    await post(userB, '/api/shared/decks/operator-blocked/report')
      .send({ reason: 'The facts are dangerously wrong.' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/operator/deck-reports')
      .expect(401);
    const reports = await request(app.getHttpServer())
      .get('/api/operator/deck-reports')
      .set('x-moderation-operator-key', 'test-operator-key')
      .expect(200);
    expect((reports.body as { reports: unknown[] }).reports).toEqual([
      expect.objectContaining({
        deckId: 'operator-blocked',
        reporterUserId: userB.id,
      }),
    ]);

    await request(app.getHttpServer())
      .post('/api/operator/decks/operator-blocked/takedown')
      .send({ reason: 'Copyright complaint verified.' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/operator/decks/operator-blocked/takedown')
      .set('x-moderation-operator-key', 'test-operator-key')
      .send({
        reason: 'Copyright complaint verified.',
        expectedPublishedAt: (
          await storedPublication('operator-blocked')
        ).publishedAt.toISOString(),
        operatorUserId: userB.id,
      })
      .expect(200);
    expect((await storedDeck('operator-blocked')).visibility).toBe('private');
    expect(await db.select().from(deckTakedowns)).toEqual([
      expect.objectContaining({
        deckId: 'operator-blocked',
        source: 'operator',
        operatorUserId: null,
        reason: 'Copyright complaint verified.',
      }),
    ]);
  });

  it('authorizes only completed allowlisted sessions and exposes only their capability', async () => {
    await seedDeck(userA, 'access-check', { visibility: 'public' });
    await post(userC, '/api/shared/decks/access-check/report')
      .send({ reason: 'Review please.' })
      .expect(201);
    const publishedAt = (
      await storedPublication('access-check')
    ).publishedAt.toISOString();
    for (const path of [
      '/api/operator/capabilities',
      '/api/operator/deck-reports',
      '/api/operator/decks/access-check',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
    await request(app.getHttpServer())
      .get('/api/operator/capabilities')
      .set('x-moderation-operator-key', 'test-operator-key')
      .expect(401);
    const denied = await get(
      userA,
      '/api/operator/capabilities?canModerate=true&role=admin',
    ).expect(200);
    expect(operatorCapabilitiesSchema.parse(denied.body)).toEqual({
      canModerate: false,
    });
    expect(denied.body).toEqual({ canModerate: false });
    const allowed = await get(userB, '/api/operator/capabilities').expect(200);
    expect(allowed.body).toEqual({ canModerate: true });
    for (const path of [
      '/api/operator/deck-reports',
      '/api/operator/decks/access-check',
    ]) {
      await get(userA, path)
        .set('x-user-id', userB.id)
        .set('x-role', 'admin')
        .expect(403);
      await get(userA, path)
        .set('x-moderation-operator-key', 'wrong')
        .expect(403);
      await get(userB, path)
        .set('x-moderation-operator-key', 'wrong')
        .expect(200);
    }
    await request(app.getHttpServer())
      .get('/api/operator/deck-reports')
      .set('x-moderation-operator-key', 'wrong')
      .expect(401);
    await post(userA, '/api/operator/decks/access-check/takedown')
      .set('Origin', 'http://localhost:5173')
      .send({
        reason: 'Forged permission.',
        expectedPublishedAt: publishedAt,
        canModerate: true,
        role: 'admin',
        operatorUserId: userB.id,
      })
      .expect(403);
    expect(await db.select().from(deckTakedowns)).toEqual([]);
    expect((await storedDeck('access-check')).visibility).toBe('public');
  });

  it.each([undefined, '', ' , , '])(
    'disables session moderation for an absent/empty allowlist (%s)',
    async (configuration) => {
      const previous = process.env.MODERATION_ADMIN_USER_IDS;
      if (configuration === undefined)
        delete process.env.MODERATION_ADMIN_USER_IDS;
      else process.env.MODERATION_ADMIN_USER_IDS = configuration;
      let emptyApp: INestApplication<App> | undefined;
      try {
        emptyApp = await createApp();
        const server = emptyApp.getHttpServer();
        await request(server)
          .get('/api/operator/capabilities')
          .set('Cookie', userB.cookie)
          .expect(200, { canModerate: false });
        await request(server)
          .get('/api/operator/deck-reports')
          .set('Cookie', userB.cookie)
          .expect(403);
        await request(server)
          .get('/api/operator/decks/any')
          .set('Cookie', userB.cookie)
          .expect(403);
        await request(server)
          .post('/api/operator/decks/any/takedown')
          .set('Cookie', userB.cookie)
          .set('Origin', 'http://localhost:5173')
          .send({ reason: 'No permission.' })
          .expect(403);
        await request(server)
          .get('/api/operator/deck-reports')
          .set('x-moderation-operator-key', 'test-operator-key')
          .expect(200);
        // The already-running API retains its startup policy until recreated.
        await get(userB, '/api/operator/capabilities').expect(200, {
          canModerate: true,
        });
      } finally {
        await emptyApp?.close();
        if (previous === undefined)
          delete process.env.MODERATION_ADMIN_USER_IDS;
        else process.env.MODERATION_ADMIN_USER_IDS = previous;
      }
    },
  );

  it('rejects a pending second factor and accepts the completed admin login', async () => {
    const enabled = await post(twoFactorAdmin, '/api/auth/two-factor/enable')
      .set('Origin', 'http://localhost:5173')
      .send({ password: 'SharingPassword123!' })
      .expect(200);
    const encodedSecret = new URL(
      (enabled.body as { totpURI: string }).totpURI,
    ).searchParams.get('secret')!;
    const secret = new TextDecoder().decode(base32.decode(encodedSecret));
    const code = await createOTP(secret).totp();
    await post(twoFactorAdmin, '/api/auth/two-factor/verify-totp')
      .set('Origin', 'http://localhost:5173')
      .send({ code })
      .expect(200);
    const challenge = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'sharing-2fa-admin@example.test',
        password: 'SharingPassword123!',
      })
      .expect(200);
    expect(challenge.body).toMatchObject({ twoFactorRedirect: true });
    const cookies = responseCookies(challenge);
    for (const path of [
      '/api/operator/capabilities',
      '/api/operator/deck-reports',
      '/api/operator/decks/any',
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set('Cookie', cookies)
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/operator/decks/any/takedown')
      .set('Cookie', cookies)
      .set('Origin', 'http://localhost:5173')
      .send({ reason: 'Pending challenge.' })
      .expect(401);
    // The plugin limits second-factor endpoints to three requests per ten seconds.
    await new Promise((resolve) => setTimeout(resolve, 11_000));
    const completed = await request(app.getHttpServer())
      .post('/api/auth/two-factor/verify-totp')
      .set('Cookie', cookies)
      .set('Origin', 'http://localhost:5173')
      .send({ code: await createOTP(secret).totp() })
      .expect(200);
    const completedCookies = responseCookies(completed);
    await request(app.getHttpServer())
      .get('/api/operator/capabilities')
      .set('Cookie', completedCookies)
      .expect(200, { canModerate: true });
    await request(app.getHttpServer())
      .get('/api/operator/deck-reports')
      .set('Cookie', completedCookies)
      .expect(200);
    await seedDeck(userA, 'completed-2fa', { visibility: 'public' });
    await post(userC, '/api/shared/decks/completed-2fa/report')
      .send({ reason: 'Second-factor review.' })
      .expect(201);
    const reviewed = operatorDeckReviewSchema.parse(
      (
        await request(app.getHttpServer())
          .get('/api/operator/decks/completed-2fa')
          .set('Cookie', completedCookies)
          .expect(200)
      ).body,
    );
    await request(app.getHttpServer())
      .post('/api/operator/decks/completed-2fa/takedown')
      .set('Cookie', completedCookies)
      .set('Origin', 'http://localhost:5173')
      .send({
        reason: 'Completed second factor.',
        expectedPublishedAt: reviewed.currentSnapshotPublishedAt!.toISOString(),
      })
      .expect(200);
    expect((await db.select().from(deckTakedowns))[0].operatorUserId).toBe(
      twoFactorAdmin.id,
    );
  }, 20_000);

  it.each([
    undefined,
    'null',
    'https://attacker.example',
    'http://localhost:5173.attacker.example',
    'http://localhost:5174',
  ])(
    'rejects a session mutation with an untrusted/missing Origin (%s)',
    async (origin) => {
      await seedDeck(userA, 'csrf', { visibility: 'public' });
      const before = await storedDeck('csrf');
      const mutation = post(userB, '/api/operator/decks/csrf/takedown');
      if (origin !== undefined) mutation.set('Origin', origin);
      await mutation
        .send({
          reason: 'Cross-site complaint.',
          expectedPublishedAt: (
            await storedPublication('csrf')
          ).publishedAt.toISOString(),
        })
        .expect(403);
      expect(await db.select().from(deckTakedowns)).toEqual([]);
      expect(await storedDeck('csrf')).toEqual(before);
      expect((await storedPublication('csrf')).moderationStatus).toBe(
        'visible',
      );
    },
  );

  it('reviews the complete published snapshot and classifier findings, preserving pagination and privacy', async () => {
    const { cardIds, noteIds } = await seedDeck(userA, 'review', {
      visibility: 'public',
      cards: 12,
    });
    await post(userC, '/api/shared/decks/review/report')
      .send({ reason: 'First report.' })
      .expect(201);
    await post(userB, '/api/shared/decks/review/report')
      .send({ reason: 'Second report.' })
      .expect(201);
    const verdict = {
      flagged: [],
      warnings: [
        {
          cardId: cardIds[0],
          reason: 'Controversial',
          classifier: 'moderation-thorough',
        },
      ],
      results: [
        {
          cardId: cardIds[0],
          classifier: 'moderation',
          verdict: 'safe' as const,
          categories: [],
        },
        {
          cardId: cardIds[0],
          classifier: 'moderation-thorough',
          verdict: 'controversial' as const,
          categories: null,
        },
        {
          cardId: cardIds[1],
          classifier: 'moderation-thorough',
          verdict: 'error' as const,
          categories: null,
          error: 'Classifier unavailable',
        },
      ],
    };
    await db
      .update(publishedDecks)
      .set({ moderationVerdict: verdict })
      .where(eq(publishedDecks.deckId, 'review'));
    await db
      .update(userDecks)
      .set({ title: 'PRIVATE WORKING TITLE' })
      .where(eq(userDecks.id, 'review'));
    await db
      .update(userCards)
      .set({ front: 'PRIVATE WORKING CARD' })
      .where(eq(userCards.id, cardIds[0]));
    await db
      .update(userNotes)
      .set({
        fieldsJson: '{"front":"PRIVATE NOTE"}',
        additionalContent: 'PRIVATE NOTES',
      })
      .where(eq(userNotes.id, noteIds[0]));
    const first = await get(
      userB,
      '/api/operator/deck-reports?limit=1&offset=0',
    ).expect(200);
    const second = await get(
      userB,
      '/api/operator/deck-reports?limit=1&offset=1',
    ).expect(200);
    const firstPage = operatorReportPageSchema.parse(first.body);
    const secondPage = operatorReportPageSchema.parse(second.body);
    expect(firstPage.reports).toHaveLength(1);
    expect(secondPage.reports).toHaveLength(1);
    expect(firstPage.reports[0].id).not.toBe(secondPage.reports[0].id);
    expect(firstPage.reports[0]).toMatchObject({
      title: 'Deck review',
      owner: { username: 'user-a' },
      status: 'visible',
      publicationChanged: false,
      moderationVerdict: verdict,
    });
    const response = await get(userB, '/api/operator/decks/review').expect(200);
    const review = operatorDeckReviewSchema.parse(response.body);
    expect(review.deck?.cards).toHaveLength(12);
    expect(review.deck?.cards[0]).toEqual({
      id: cardIds[0],
      front: 'front 0',
      back: 'back 0',
    });
    expect(review.moderationVerdict).toEqual(verdict);
    expect(review.currentSnapshotPublishedAt).toEqual(
      (await storedPublication('review')).publishedAt,
    );
    expect(review.reports.map((report) => report.publicationChanged)).toEqual([
      false,
      false,
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /PRIVATE|email|password|private-image-id|private-audio-id|MODERATION_/,
    );
    await takedown(
      userB,
      'review',
      review.currentSnapshotPublishedAt!.toISOString(),
    ).expect(200);
    const retained = operatorDeckReviewSchema.parse(
      (await get(userB, '/api/operator/decks/review').expect(200)).body,
    );
    expect(retained.status).toBe('blocked');
    expect(retained.moderationVerdict).toEqual({
      ...verdict,
      reason: 'Reviewed complaint.',
    });
    await seedDeck(userA, 'never-reported', { visibility: 'public' });
    await get(userB, '/api/operator/decks/never-reported').expect(404);
  });

  it.each([
    'unpublished',
    'deleted',
    'missing-deck',
    'missing-publication',
    'private',
  ])(
    'retains report metadata and never substitutes private content for an unavailable publication (%s)',
    async (state) => {
      await seedDeck(userA, 'unavailable', { visibility: 'public' });
      const report = await post(userC, '/api/shared/decks/unavailable/report')
        .send({ reason: 'Keep this metadata.' })
        .expect(201);
      const publishedAt = (
        await storedPublication('unavailable')
      ).publishedAt.toISOString();
      await db.update(userCards).set({ front: 'PRIVATE CONTENT' });
      if (state === 'unpublished')
        await post(userA, '/api/decks/unavailable/unpublish').expect(200);
      if (state === 'deleted')
        await db
          .update(userDecks)
          .set({ deletedAt: new Date() })
          .where(eq(userDecks.id, 'unavailable'));
      if (state === 'missing-deck')
        await db.delete(userDecks).where(eq(userDecks.id, 'unavailable'));
      if (state === 'missing-publication')
        await db
          .delete(publishedDecks)
          .where(eq(publishedDecks.deckId, 'unavailable'));
      if (state === 'private')
        await db
          .update(userDecks)
          .set({ visibility: 'private' })
          .where(eq(userDecks.id, 'unavailable'));
      const reviewResponse = await get(
        userB,
        '/api/operator/decks/unavailable',
      ).expect(200);
      const review = operatorDeckReviewSchema.parse(reviewResponse.body);
      expect(review).toMatchObject({
        status: 'unavailable',
        deck: null,
        reports: [{ reason: 'Keep this metadata.' }],
      });
      expect(review.reports[0].snapshotPublishedAt.toISOString()).toBe(
        (report.body as { report: { snapshotPublishedAt: string } }).report
          .snapshotPublishedAt,
      );
      expect(JSON.stringify(reviewResponse.body)).not.toContain(
        'PRIVATE CONTENT',
      );
      const page = operatorReportPageSchema.parse(
        (await get(userB, '/api/operator/deck-reports').expect(200)).body,
      );
      expect(page.reports).toHaveLength(1);
      expect(page.reports[0].status).toBe('unavailable');
      const failed = await takedown(userB, 'unavailable', publishedAt).expect(
        404,
      );
      expect(operatorTakedownErrorSchema.parse(failed.body).code).toBe(
        'PUBLICATION_UNAVAILABLE',
      );
      expect(await db.select().from(deckTakedowns)).toEqual([]);
    },
  );

  it.each([
    {},
    { reason: '' },
    { reason: '   ' },
    { reason: 'x'.repeat(2_001) },
    { reason: 1 },
    { reason: 'Valid reason.', expectedPublishedAt: undefined },
    { reason: 'Valid reason.', expectedPublishedAt: 'not-a-date' },
    {
      reason: 'Valid reason.',
      expectedPublishedAt: '2026-02-30T00:00:00.000Z',
    },
  ])(
    'validates reasons and requires a publication timestamp (%j)',
    async (input) => {
      await seedDeck(userA, 'validation', { visibility: 'public' });
      await post(userB, '/api/operator/decks/validation/takedown')
        .set('Origin', 'http://localhost:5173')
        .send({
          expectedPublishedAt: (
            await storedPublication('validation')
          ).publishedAt.toISOString(),
          ...input,
        })
        .expect(400);
      expect(await db.select().from(deckTakedowns)).toEqual([]);
      expect((await storedDeck('validation')).visibility).toBe('public');
    },
  );

  it('records the authenticated actor and trimmed reason atomically with visibility/sync effects, keeping imported copies usable', async () => {
    await seedDeck(userA, 'session-blocked', { visibility: 'public' });
    await post(userC, '/api/shared/decks/session-blocked/report')
      .send({ reason: 'Complaint.' })
      .expect(201);
    const imported = await post(
      userC,
      '/api/shared/decks/session-blocked/import',
    ).expect(201);
    const importedId = sharedDeckImportSchema.parse(imported.body).deckId;
    const before = await storedDeck('session-blocked');
    const importedBefore = await storedDeck(importedId);
    const cursor = (await pull(userA)).cursor;
    const reviewed = operatorDeckReviewSchema.parse(
      (await get(userB, '/api/operator/decks/session-blocked').expect(200))
        .body,
    );
    const response = await post(
      userB,
      '/api/operator/decks/session-blocked/takedown',
    )
      .set('Origin', 'http://localhost:5173')
      .send({
        reason: '  Copyright complaint verified.  ',
        expectedPublishedAt: reviewed.currentSnapshotPublishedAt!.toISOString(),
        operatorUserId: userA.id,
        operator_user_id: userA.id,
      })
      .expect(200);
    expect(operatorTakedownResponseSchema.parse(response.body)).toEqual({
      status: 'blocked',
      snapshotPublishedAt: reviewed.currentSnapshotPublishedAt,
    });
    const after = await storedDeck('session-blocked');
    expect(after.visibility).toBe('private');
    expect(after.rev).toBeGreaterThan(before.rev);
    expect((await storedPublication('session-blocked')).moderationStatus).toBe(
      'blocked',
    );
    expect(await db.select().from(deckTakedowns)).toEqual([
      expect.objectContaining({
        source: 'operator',
        operatorUserId: userB.id,
        reason: 'Copyright complaint verified.',
        snapshotPublishedAt: reviewed.currentSnapshotPublishedAt,
      }),
    ]);
    expect((await pull(userA, cursor)).changes.user_decks.updated).toEqual([
      expect.objectContaining({ id: 'session-blocked', visibility: 'private' }),
    ]);
    expect(
      (await get(userA, '/api/decks/session-blocked/moderation').expect(200))
        .body,
    ).toMatchObject({
      status: 'blocked',
      reason: 'Copyright complaint verified.',
    });
    expect(await browse(userC)).toEqual([]);
    await get(userC, '/api/shared/decks/session-blocked').expect(404);
    await post(userC, '/api/shared/decks/session-blocked/import').expect(404);
    expect(await storedDeck(importedId)).toEqual(importedBefore);
    await get(userC, `/api/shared/decks/${importedId}`).expect(200);
    await db
      .update(userCards)
      .set({ front: 'PRIVATE EDIT AFTER BLOCK' })
      .where(eq(userCards.userId, userA.id));
    const blockedReview = operatorDeckReviewSchema.parse(
      (await get(userB, '/api/operator/decks/session-blocked').expect(200))
        .body,
    );
    expect(blockedReview.status).toBe('blocked');
    expect(blockedReview.deck?.cards[0].front).toBe('front 0');
    const page = operatorReportPageSchema.parse(
      (await get(userB, '/api/operator/deck-reports').expect(200)).body,
    );
    expect(page.reports[0].status).toBe('blocked');
    await takedown(
      userB,
      'session-blocked',
      reviewed.currentSnapshotPublishedAt!.toISOString(),
    ).expect(404);
    expect(await db.select().from(deckTakedowns)).toHaveLength(1);
  });

  it('distinguishes republished content from the report and rejects a stale reviewed publication without writes', async () => {
    await seedDeck(userA, 'stale-review', {
      visibility: 'public',
      updatedAt: Date.now() - 10_000,
    });
    await post(userC, '/api/shared/decks/stale-review/report')
      .send({ reason: 'The first version.' })
      .expect(201);
    const reviewed = operatorDeckReviewSchema.parse(
      (await get(userB, '/api/operator/decks/stale-review').expect(200)).body,
    );
    await db
      .update(userCards)
      .set({ front: 'new publication' })
      .where(eq(userCards.userId, userA.id));
    await post(userA, '/api/decks/stale-review/publish').expect(200);
    const before = await storedDeck('stale-review');
    const response = await takedown(
      userB,
      'stale-review',
      reviewed.currentSnapshotPublishedAt!.toISOString(),
    ).expect(409);
    expect(operatorTakedownErrorSchema.parse(response.body).code).toBe(
      'PUBLICATION_CHANGED',
    );
    const current = operatorDeckReviewSchema.parse(
      (await get(userB, '/api/operator/decks/stale-review').expect(200)).body,
    );
    expect(current.reports[0].publicationChanged).toBe(true);
    expect(current.reports[0].snapshotPublishedAt).toEqual(
      reviewed.currentSnapshotPublishedAt,
    );
    expect(current.deck?.cards[0].front).toBe('new publication');
    const page = operatorReportPageSchema.parse(
      (await get(userB, '/api/operator/deck-reports').expect(200)).body,
    );
    expect(page.reports[0].publicationChanged).toBe(true);
    expect(await storedDeck('stale-review')).toEqual(before);
    expect(await db.select().from(deckTakedowns)).toEqual([]);
    expect((await storedPublication('stale-review')).moderationStatus).toBe(
      'visible',
    );
    await takedown(
      userB,
      'stale-review',
      current.currentSnapshotPublishedAt!.toISOString(),
    ).expect(200);
  });

  it('changes the review token even when a republish occurs in the same clock millisecond', async () => {
    await seedDeck(userA, 'same-millisecond', { visibility: 'public' });
    const before = await storedPublication('same-millisecond');
    vi.spyOn(Date, 'now').mockReturnValue(before.publishedAt.getTime());
    await post(userA, '/api/decks/same-millisecond/publish').expect(200);
    const after = await storedPublication('same-millisecond');
    expect(after.publishedAt.getTime()).toBeGreaterThan(
      before.publishedAt.getTime(),
    );
    await takedown(
      userB,
      'same-millisecond',
      before.publishedAt.toISOString(),
    ).expect(409);
    expect(await db.select().from(deckTakedowns)).toEqual([]);
  });

  it.each(['republish', 'unpublish'])(
    'rechecks the publication after waiting for the owner sync lock (%s)',
    async (change) => {
      await seedDeck(userA, 'lock-race', { visibility: 'public' });
      const publishedAt = (await storedPublication('lock-race')).publishedAt;
      let pending!: Promise<request.Response>;
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(userA.id).toString()})`,
        );
        pending = takedown(userB, 'lock-race', publishedAt.toISOString()).then(
          (response) => response,
        );
        await expect
          .poll(async () => {
            const result = await tx.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM pg_locks l
          WHERE l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND l.locktype = 'advisory' AND NOT l.granted
        `);
            return result.rows[0].count;
          })
          .toBe(1);
        if (change === 'republish') {
          await tx
            .update(publishedDecks)
            .set({ publishedAt: new Date(publishedAt.getTime() + 1_000) })
            .where(eq(publishedDecks.deckId, 'lock-race'));
        } else {
          await tx
            .delete(publishedDecks)
            .where(eq(publishedDecks.deckId, 'lock-race'));
          await tx
            .update(userDecks)
            .set({ visibility: 'private' })
            .where(eq(userDecks.id, 'lock-race'));
        }
      });
      const response = await pending;
      expect(response.status).toBe(change === 'republish' ? 409 : 404);
      expect(operatorTakedownErrorSchema.parse(response.body).code).toBe(
        change === 'republish'
          ? 'PUBLICATION_CHANGED'
          : 'PUBLICATION_UNAVAILABLE',
      );
      expect(await db.select().from(deckTakedowns)).toEqual([]);
      if (change === 'republish')
        expect((await storedDeck('lock-race')).visibility).toBe('public');
    },
  );

  it('serializes concurrent takedowns so only one writes an audit and revision', async () => {
    await seedDeck(userA, 'concurrent', { visibility: 'public' });
    const expected = (
      await storedPublication('concurrent')
    ).publishedAt.toISOString();
    const responses = await Promise.all([
      takedown(userB, 'concurrent', expected),
      takedown(userB, 'concurrent', expected),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 404,
    ]);
    expect(await db.select().from(deckTakedowns)).toHaveLength(1);
    expect((await storedDeck('concurrent')).visibility).toBe('private');
  });

  it('preserves the audit when the authenticated operator account is deleted', async () => {
    await seedDeck(userA, 'deleted-actor', { visibility: 'public' });
    await takedown(
      deletionAdmin,
      'deleted-actor',
      (await storedPublication('deleted-actor')).publishedAt.toISOString(),
    ).expect(200);
    const [before] = await db.select().from(deckTakedowns);
    expect(before.operatorUserId).toBe(deletionAdmin.id);
    await db.delete(user).where(eq(user.id, deletionAdmin.id));
    expect(await db.select().from(deckTakedowns)).toEqual([
      { ...before, operatorUserId: null },
    ]);
  });

  it('rolls back publication and sync changes if the takedown audit cannot be written', async () => {
    await seedDeck(userA, 'atomic-takedown', { visibility: 'public' });
    const before = await storedDeck('atomic-takedown');
    const snapshot = await storedPublication('atomic-takedown');
    await db.execute(
      sql`ALTER TABLE deck_takedowns ADD CONSTRAINT test_takedown_failure CHECK (deck_id <> 'atomic-takedown')`,
    );
    try {
      await takedown(
        userB,
        'atomic-takedown',
        snapshot.publishedAt.toISOString(),
      ).expect(500);
      expect(await storedDeck('atomic-takedown')).toEqual(before);
      expect(await storedPublication('atomic-takedown')).toEqual(snapshot);
      expect(await db.select().from(deckTakedowns)).toEqual([]);
    } finally {
      await db.execute(
        sql`ALTER TABLE deck_takedowns DROP CONSTRAINT test_takedown_failure`,
      );
    }
  });

  it('still rejects a client push to public after a publish and unpublish', async () => {
    await seedDeck(userA, 'pushed');
    await post(userA, '/api/decks/pushed/publish').expect(200);
    await post(userA, '/api/decks/pushed/unpublish').expect(200);

    const current = await pull(userA);
    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Cookie', userA.cookie)
      .send({
        cursor: current.cursor,
        changes: {
          user_decks: {
            created: [],
            updated: [deckWire('pushed', 'public')],
            deleted: [],
          },
        },
      })
      .expect(200);

    expect(response.body).toMatchObject({
      rejected: { user_decks: ['pushed'] },
    });
    expect((await storedDeck('pushed')).visibility).toBe('private');
  });

  it('lists public decks newest first, with the owner and a card count', async () => {
    await seedDeck(userA, 'mine', {
      cards: 2,
      visibility: 'public',
      updatedAt: 1000,
    });
    await seedDeck(userB, 'theirs', {
      cards: 1,
      visibility: 'public',
      updatedAt: 2000,
    });
    await seedDeck(userA, 'secret');
    await seedDeck(userB, 'gone', { visibility: 'public', deleted: true });

    const decks = await browse(userA);
    expect(decks).toEqual([
      {
        id: 'theirs',
        title: 'Deck theirs',
        description: 'A deck',
        noteType: BASIC_NOTE_TYPE,
        nativeLanguageId: null,
        targetLanguageId: null,
        cardCount: 1,
        owner: { username: 'user-b' },
        updatedAt: 2000,
      },
      // The caller's own public deck is listed like anyone else's.
      expect.objectContaining({
        id: 'mine',
        cardCount: 2,
        owner: { username: 'user-a' },
      }),
    ]);
  });

  it('adds a deck to the list on publish and drops it on unpublish', async () => {
    await seedDeck(userA, 'toggled');
    expect(await browse(userB)).toEqual([]);

    await post(userA, '/api/decks/toggled/publish').expect(200);
    expect((await browse(userB)).map((deck) => deck.id)).toEqual(['toggled']);

    await post(userA, '/api/decks/toggled/unpublish').expect(200);
    expect(await browse(userB)).toEqual([]);
  });

  it('paginates, clamping whatever the query carries', async () => {
    for (const index of [0, 1, 2]) {
      await seedDeck(userA, `page-${index}`, {
        visibility: 'public',
        updatedAt: 1000 + index,
      });
    }

    expect((await browse(userA, '?limit=2')).map((deck) => deck.id)).toEqual([
      'page-2',
      'page-1',
    ]);
    expect(
      (await browse(userA, '?limit=2&offset=2')).map((deck) => deck.id),
    ).toEqual(['page-0']);

    // out-of-range and unparseable paging is clamped, never refused: a
    // negative offset is 0, an empty or unparseable limit is the default
    // (all three decks, where a clamp to 1 would return one), and an
    // offset past what a bigint holds is a page, not a 500
    expect((await browse(userA, '?limit=101&offset=-3')).length).toBe(3);
    expect((await browse(userA, '?limit=')).length).toBe(3);
    expect((await browse(userA, '?limit=nope')).length).toBe(3);
    expect(await browse(userA, '?offset=1e21')).toEqual([]);
    await request(app.getHttpServer()).get('/api/shared/decks').expect(401);
  });

  it('previews a public deck for a stranger and a private one only for its owner', async () => {
    await seedDeck(userA, 'readable', { cards: 2, visibility: 'public' });
    await seedDeck(userA, 'secret');

    const shared = await get(userB, '/api/shared/decks/readable').expect(200);
    sharedDeckPreviewSchema.parse(shared.body);
    expect(shared.body).toMatchObject({
      deck: {
        id: 'readable',
        cardCount: 2,
        owner: { username: 'user-a' },
        cards: [
          { front: 'front 0', back: 'back 0' },
          { front: 'front 1', back: 'back 1' },
        ],
      },
    });

    await get(userB, '/api/shared/decks/secret').expect(404);
    await get(userB, '/api/shared/decks/no-such-deck').expect(404);
    await get(userA, '/api/shared/decks/secret').expect(200);
  });

  it('publishes inactive complete cards but leaves incomplete cards out', async () => {
    const source = await seedDeck(userA, 'publishable', { cards: 2 });
    await db
      .update(userCards)
      .set({ active: false })
      .where(eq(userCards.id, source.cardIds[0]));
    await db
      .update(userCards)
      .set({ front: '' })
      .where(eq(userCards.id, source.cardIds[1]));

    await post(userA, '/api/decks/publishable/publish').expect(200);

    const shared = await get(userB, '/api/shared/decks/publishable').expect(
      200,
    );
    expect(shared.body).toMatchObject({
      deck: {
        cardCount: 1,
        cards: [{ front: 'front 0', back: 'back 0' }],
      },
    });
    expect(
      (await browse(userB)).find((deck) => deck.id === 'publishable'),
    ).toMatchObject({ cardCount: 1 });
  });

  it('caps a preview at ten cards and exposes nothing but their text', async () => {
    await seedDeck(userA, 'long', { cards: 12, visibility: 'public' });

    const response = await get(userA, '/api/shared/decks/long').expect(200);
    const { cards, cardCount } = (
      response.body as {
        deck: { cardCount: number; cards: Record<string, string>[] };
      }
    ).deck;

    expect(cardCount).toBe(12);
    expect(cards).toHaveLength(10);
    expect(cards[0]).toEqual({ front: 'front 0', back: 'back 0' });
    for (const card of cards)
      expect(Object.keys(card)).toEqual(['front', 'back']);
  });

  it('does not preview a tombstoned deck, public or owned', async () => {
    await seedDeck(userA, 'buried', { visibility: 'public', deleted: true });

    await get(userB, '/api/shared/decks/buried').expect(404);
    await get(userA, '/api/shared/decks/buried').expect(404);
  });
  it('lists a word deck with its language pair', async () => {
    // the language ids are fixed sentinels, not RFC uuids; the wire schema
    // must accept them or every word deck fails to parse on the web
    await seedDeck(userA, 'words', {
      visibility: 'public',
      languages: { native: GERMAN, target: ENGLISH },
    });
    const [deck] = await browse(userA);
    expect(deck).toMatchObject({
      id: 'words',
      noteType: WORD_NOTE_TYPE,
      nativeLanguageId: GERMAN,
      targetLanguageId: ENGLISH,
    });
  });

  it('refuses to publish for an account that never finished onboarding', async () => {
    // signUp alone gives a session but no profile; only onboarding sets a
    // username, and browse joins on it
    const userC = await signUp('c');
    await seedDeck(userC, 'unnamed');
    const before = await storedDeck('unnamed');

    const response = await post(userC, '/api/decks/unnamed/publish').expect(
      422,
    );
    expect(response.body).toEqual({
      reason: 'finish onboarding before publishing',
      flagged: [],
    });
    moderationRefusalSchema.parse(response.body);
    expect(await storedDeck('unnamed')).toEqual(before);
  });

  it('answers 404 when the deck is tombstoned between the check and the write', async () => {
    await seedDeck(userA, 'vanishing');
    vi.spyOn(app.get(ModerationService), 'check').mockImplementation(
      async () => {
        await db
          .update(userDecks)
          .set({ deletedAt: new Date() })
          .where(eq(userDecks.id, 'vanishing'));
        return { ok: true, flagged: [], warnings: [], results: [] };
      },
    );

    await post(userA, '/api/decks/vanishing/publish').expect(404);
    expect((await storedDeck('vanishing')).visibility).toBe('private');
  });

  it.each(['deck', 'note', 'card', 'membership'] as const)(
    'publishes the checked snapshot when a %s syncs during moderation',
    async (changed) => {
      const { noteIds, cardIds } = await seedDeck(userA, 'racing');
      const cursor = (await pull(userA)).cursor;
      const now = Date.now();
      const edits = {
        deck: {
          table: 'user_decks',
          row: deckWire('racing', 'private', 'Changed title'),
        },
        note: {
          table: 'user_notes',
          row: {
            id: noteIds[0],
            note_type: BASIC_NOTE_TYPE,
            fields_version: BASIC_NOTE_FIELDS_VERSION,
            fields_json: JSON.stringify({ front: 'edited', back: 'back 0' }),
            additional_content: null,
            created_at: now,
            updated_at: now,
          },
        },
        card: {
          table: 'user_cards',
          row: {
            id: cardIds[0],
            note_id: noteIds[0],
            template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
            active: true,
            front: 'not checked',
            back: 'back 0',
            due_at: now,
            scheduled_interval_minutes: 0,
            created_at: now,
            updated_at: now,
          },
        },
        membership: {
          table: 'user_note_decks',
          row: {
            id: noteDeckId(noteIds[0], 'racing'),
            note_id: noteIds[0],
            deck_id: 'racing',
            active: false,
            created_at: now,
            updated_at: now,
          },
        },
      };
      vi.spyOn(app.get(ModerationService), 'check').mockImplementationOnce(
        async ({ cards }) => {
          expect(cards[0].front).toBe('front 0');
          const { table, row } = edits[changed];
          // A real push must finish while moderation is in progress. Holding
          // the owner's scope lock across the check would deadlock this test.
          const response = await post(userA, '/sync/push')
            .send({
              cursor,
              changes: {
                [table]: { created: [], updated: [row], deleted: [] },
              },
            })
            .expect(200);
          const body = response.body as { rejected?: Record<string, string[]> };
          expect(body.rejected ?? {}).toEqual({});
          return { ok: true, flagged: [], warnings: [], results: [] };
        },
      );

      await post(userA, '/api/decks/racing/publish').expect(200);
      expect((await storedDeck('racing')).visibility).toBe('public');
      const [snapshot] = await db.select().from(publishedDecks);
      expect(snapshot.title).toBe('Deck racing');
      expect(snapshot.content.cards).toEqual([
        expect.objectContaining({ front: 'front 0', back: 'back 0' }),
      ]);
      expect(JSON.parse(snapshot.content.notes[0].fields_json)).toEqual({
        front: 'front 0',
        back: 'back 0',
      });
      const preview = await get(userB, '/api/shared/decks/racing').expect(200);
      expect(preview.body).toMatchObject({
        deck: {
          title: 'Deck racing',
          cards: [{ front: 'front 0', back: 'back 0' }],
        },
      });
    },
  );

  it('does not publish a membership added to an empty deck during moderation', async () => {
    await seedDeck(userA, 'empty', { cards: 0 });
    const { noteIds } = await seedDeck(userA, 'source');
    const cursor = (await pull(userA)).cursor;
    vi.spyOn(app.get(ModerationService), 'check').mockImplementationOnce(
      async ({ cards }) => {
        expect(cards).toEqual([]);
        const now = Date.now();
        const response = await post(userA, '/sync/push')
          .send({
            cursor,
            changes: {
              user_note_decks: {
                created: [
                  {
                    id: noteDeckId(noteIds[0], 'empty'),
                    note_id: noteIds[0],
                    deck_id: 'empty',
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
        const body = response.body as { rejected?: Record<string, string[]> };
        expect(body.rejected ?? {}).toEqual({});
        return { ok: true, flagged: [], warnings: [], results: [] };
      },
    );

    await post(userA, '/api/decks/empty/publish').expect(200);
    const [snapshot] = await db.select().from(publishedDecks);
    expect(snapshot.content).toEqual({ notes: [], cards: [] });
    expect(snapshot.cardCount).toBe(0);
  });

  it('keeps edits private until republish, and keeps the previous snapshot on refusal', async () => {
    const { noteIds, cardIds } = await seedDeck(userA, 'working', {
      visibility: 'public',
    });
    const [before] = await db.select().from(publishedDecks);
    const cursor = (await pull(userA)).cursor;
    const now = Date.now();
    const response = await post(userA, '/sync/push')
      .send({
        cursor,
        changes: {
          user_decks: {
            created: [],
            updated: [deckWire('working', 'public', 'New title')],
            deleted: [],
          },
          user_cards: {
            created: [],
            updated: [
              {
                id: cardIds[0],
                note_id: noteIds[0],
                template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
                active: true,
                front: 'new front',
                back: 'new back',
                due_at: now,
                scheduled_interval_minutes: 0,
                created_at: now,
                updated_at: now,
              },
            ],
            deleted: [],
          },
        },
      })
      .expect(200);
    expect((response.body as { rejected?: unknown }).rejected ?? {}).toEqual(
      {},
    );
    expect((await storedDeck('working')).visibility).toBe('public');
    const changes = (await pull(userA, cursor)).changes;
    expect(changes.user_cards.updated).toEqual([
      expect.objectContaining({ front: 'new front' }),
    ]);
    expect(await browse(userB)).toEqual([
      expect.objectContaining({
        title: 'Deck working',
        updatedAt: before.publishedAt.getTime(),
      }),
    ]);
    const preview = await get(userB, '/api/shared/decks/working').expect(200);
    expect(preview.body).toMatchObject({
      deck: { cards: [{ front: 'front 0', back: 'back 0' }] },
    });

    vi.spyOn(app.get(ModerationService), 'check').mockResolvedValueOnce({
      ok: false,
      flagged: [],
      warnings: [],
      reason: 'refused',
      results: [],
    });
    await post(userA, '/api/decks/working/publish').expect(422);
    expect(await db.select().from(publishedDecks)).toEqual([before]);
    await post(userA, '/api/decks/working/publish').expect(200);
    const updated = await get(userB, '/api/shared/decks/working').expect(200);
    expect(updated.body).toMatchObject({
      deck: {
        title: 'New title',
        cards: [{ front: 'new front', back: 'new back' }],
      },
    });

    await db
      .update(userDecks)
      .set({ deletedAt: new Date() })
      .where(eq(userDecks.id, 'working'));
    expect(await db.select().from(publishedDecks)).toHaveLength(1);
    expect(await browse(userB)).toEqual([]);
    await get(userB, '/api/shared/decks/working').expect(404);
  });

  it('requires legacy public decks without a snapshot to be republished', async () => {
    await seedDeck(userA, 'legacy');
    await db
      .update(userDecks)
      .set({ visibility: 'public' })
      .where(eq(userDecks.id, 'legacy'));
    expect(await browse(userB)).toEqual([]);
    await get(userB, '/api/shared/decks/legacy').expect(404);
    await get(userA, '/api/shared/decks/legacy').expect(200);
    await post(userA, '/api/decks/legacy/publish').expect(200);
    await get(userB, '/api/shared/decks/legacy').expect(200);
  });

  const importDeck = async (user: TestUser, sourceId: string) => {
    const response = await post(
      user,
      `/api/shared/decks/${sourceId}/import`,
    ).expect(201);
    return sharedDeckImportSchema.parse(response.body).deckId;
  };

  it('imports independent private copies of the snapshot with fresh schedules into the next pull', async () => {
    const source = await seedDeck(userA, 'original');
    await db
      .update(userNotes)
      .set({ additionalContent: 'Extra context' })
      .where(eq(userNotes.id, source.noteIds[0]));
    await db
      .update(userCards)
      .set({ dueAt: 1, scheduledIntervalMinutes: 500 })
      .where(eq(userCards.id, source.cardIds[0]));
    await post(userA, '/api/decks/original/publish').expect(200);
    // Import must use the checked copy, not subsequent working-copy edits.
    await db
      .update(userCards)
      .set({ front: 'Unpublished edit' })
      .where(eq(userCards.id, source.cardIds[0]));
    await db
      .update(userDecks)
      .set({ title: 'Unpublished title' })
      .where(eq(userDecks.id, 'original'));
    const start = await pull(userB);
    const before = Date.now();
    const first = await importDeck(userB, 'original');
    const second = await importDeck(userB, 'original');
    expect(first).not.toBe(second);

    const decks = await db
      .select()
      .from(userDecks)
      .where(eq(userDecks.userId, userB.id));
    const notes = await db
      .select()
      .from(userNotes)
      .where(eq(userNotes.userId, userB.id));
    const cards = await db
      .select()
      .from(userCards)
      .where(eq(userCards.userId, userB.id));
    const memberships = await db
      .select()
      .from(userNoteDecks)
      .where(eq(userNoteDecks.userId, userB.id));
    expect(decks).toHaveLength(2);
    expect(notes).toHaveLength(2);
    expect(cards).toHaveLength(2);
    expect(memberships).toHaveLength(2);
    for (const deck of decks)
      expect(deck).toMatchObject({
        title: 'Deck original',
        description: 'A deck',
        visibility: 'private',
        noteType: BASIC_NOTE_TYPE,
      });
    for (const note of notes) {
      expect(source.noteIds).not.toContain(note.id);
      expect(note).toMatchObject({
        noteType: BASIC_NOTE_TYPE,
        fieldsVersion: 1,
        additionalContent: 'Extra context',
      });
      expect(JSON.parse(note.fieldsJson)).toEqual({
        front: 'front 0',
        back: 'back 0',
      });
    }
    for (const card of cards) {
      expect(card.id).toBe(cardId(card.noteId, card.templateKey));
      expect(card).toMatchObject({
        front: 'front 0',
        back: 'back 0',
        scheduledIntervalMinutes: 0,
        active: false,
      });
      expect(card.dueAt).toBeGreaterThanOrEqual(before);
      expect(card.dueAt).toBeLessThanOrEqual(Date.now());
    }
    for (const membership of memberships) {
      expect(membership.id).toBe(
        noteDeckId(membership.noteId, membership.deckId),
      );
      expect([first, second]).toContain(membership.deckId);
      expect(notes.map((note) => note.id)).toContain(membership.noteId);
    }
    const changes = (await pull(userB, start.cursor)).changes;
    for (const table of [
      'user_decks',
      'user_notes',
      'user_cards',
      'user_note_decks',
    ]) {
      expect([
        ...changes[table].created,
        ...changes[table].updated,
      ]).toHaveLength(2);
    }
    // Owners may import their own public deck, too.
    const ownCopy = await importDeck(userA, 'original');
    expect((await storedDeck(ownCopy)).visibility).toBe('private');
    const cursor = (await pull(userA)).cursor;
    await post(userA, '/sync/push')
      .send({
        cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['original'] },
        },
      })
      .expect(200);
    expect((await storedDeck('original')).deletedAt).not.toBeNull();
    expect(await storedDeck(first)).toEqual(
      decks.find((deck) => deck.id === first),
    );
    expect(
      await db.select().from(userCards).where(eq(userCards.userId, userB.id)),
    ).toEqual(cards);
  });

  it('imports word notes and their sibling cards without media references', async () => {
    await seedDeck(userA, 'word-source', {
      visibility: 'public',
      languages: { native: GERMAN, target: ENGLISH },
    });
    const deckId = await importDeck(userB, 'word-source');
    expect(await storedDeck(deckId)).toMatchObject({
      noteType: WORD_NOTE_TYPE,
      nativeLanguageId: GERMAN,
      targetLanguageId: ENGLISH,
    });
    const [note] = await db
      .select()
      .from(userNotes)
      .where(eq(userNotes.userId, userB.id));
    const fields: unknown = JSON.parse(note.fieldsJson);
    expect(fields).toMatchObject({
      native_language_id: GERMAN,
      target_language_id: ENGLISH,
    });
    expect(fields).not.toHaveProperty('image');
    expect(fields).not.toHaveProperty('word_audio');
    const compiled = compileNote(note.noteType, note.fieldsVersion, fields);
    const cards = await db
      .select()
      .from(userCards)
      .where(eq(userCards.userId, userB.id));
    expect(cards).toHaveLength(compiled.cards.length);
    for (const card of compiled.cards)
      expect(cards).toContainEqual(
        expect.objectContaining({
          id: cardId(note.id, card.templateKey),
          noteId: note.id,
          templateKey: card.templateKey,
          front: card.front,
          back: card.back,
          active: false,
          scheduledIntervalMinutes: 0,
        }),
      );
  });

  it('preserves the published note order for future activation', async () => {
    await seedDeck(userA, 'ordered-source', {
      cards: 2,
      visibility: 'public',
    });

    const deckId = await importDeck(userB, 'ordered-source');
    const imported = await db
      .select({
        createdAt: userNoteDecks.createdAt,
        fields: userNotes.fieldsJson,
      })
      .from(userNoteDecks)
      .innerJoin(userNotes, eq(userNotes.id, userNoteDecks.noteId))
      .where(eq(userNoteDecks.deckId, deckId))
      .orderBy(asc(userNoteDecks.createdAt));

    const importedFields = imported.map(
      ({ fields }) => JSON.parse(fields) as { front: string; back: string },
    );
    expect(importedFields).toEqual([
      { front: 'front 0', back: 'back 0' },
      { front: 'front 1', back: 'back 1' },
    ]);
    expect(imported[1].createdAt).toBeGreaterThan(imported[0].createdAt);
  });

  it.each(['private', 'unpublished', 'deleted', 'legacy', 'missing'])(
    'refuses importing a %s source, even for the owner',
    async (state) => {
      if (state !== 'missing')
        await seedDeck(userA, 'unavailable', {
          visibility: ['unpublished', 'deleted'].includes(state)
            ? 'public'
            : 'private',
        });
      if (state === 'unpublished')
        await post(userA, '/api/decks/unavailable/unpublish').expect(200);
      if (state === 'deleted')
        await db
          .update(userDecks)
          .set({ deletedAt: new Date() })
          .where(eq(userDecks.id, 'unavailable'));
      if (state === 'legacy')
        await db
          .update(userDecks)
          .set({ visibility: 'public' })
          .where(eq(userDecks.id, 'unavailable'));
      await post(userB, '/api/shared/decks/unavailable/import').expect(404);
      await post(userA, '/api/shared/decks/unavailable/import').expect(404);
      expect(
        await db.select().from(userDecks).where(eq(userDecks.userId, userB.id)),
      ).toEqual([]);
    },
  );

  it('requires authentication and can import a published empty deck', async () => {
    await seedDeck(userA, 'no-cards', { cards: 0 });
    await post(userA, '/api/decks/no-cards/publish').expect(200);
    await request(app.getHttpServer())
      .post('/api/shared/decks/no-cards/import')
      .expect(401);
    const id = await importDeck(userB, 'no-cards');
    expect((await storedDeck(id)).visibility).toBe('private');
    expect(
      await db.select().from(userNotes).where(eq(userNotes.userId, userB.id)),
    ).toEqual([]);
  });

  it('rolls back the entire copy if a card write fails', async () => {
    await seedDeck(userA, 'failing-copy', { visibility: 'public' });
    await db.execute(
      sql`ALTER TABLE user_cards ADD CONSTRAINT test_import_failure CHECK (front <> 'front 0') NOT VALID`,
    );
    try {
      await post(userB, '/api/shared/decks/failing-copy/import').expect(500);
      expect(
        await db.select().from(userDecks).where(eq(userDecks.userId, userB.id)),
      ).toEqual([]);
      expect(
        await db.select().from(userNotes).where(eq(userNotes.userId, userB.id)),
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(userNoteDecks)
          .where(eq(userNoteDecks.userId, userB.id)),
      ).toEqual([]);
      expect(
        await db.select().from(userCards).where(eq(userCards.userId, userB.id)),
      ).toEqual([]);
    } finally {
      await db.execute(
        sql`ALTER TABLE user_cards DROP CONSTRAINT test_import_failure`,
      );
    }
  });

  it('serializes import and the importer’s own push on the same scope lock', async () => {
    await seedDeck(userA, 'lock-source', { visibility: 'public' });
    await seedDeck(userB, 'my-deck');
    const cursor = (await pull(userB)).cursor;
    const requests: Promise<{ status: number; body: unknown }>[] = [];
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(userB.id).toString()})`,
      );
      requests.push(
        post(userB, '/api/shared/decks/lock-source/import').then((res) => ({
          status: res.status,
          body: res.body as unknown,
        })),
        post(userB, '/sync/push')
          .send({
            cursor,
            changes: {
              user_decks: {
                created: [],
                updated: [deckWire('my-deck', 'private', 'Renamed')],
                deleted: [],
              },
            },
          })
          .then((res) => ({ status: res.status, body: res.body as unknown })),
      );
      await expect
        .poll(async () => {
          const result = await tx.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM pg_locks l
          WHERE l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND l.locktype = 'advisory' AND NOT l.granted
        `);
          return result.rows[0].count;
        })
        .toBe(2);
    });
    const [imported, pushed] = await Promise.all(requests);
    expect(imported.status).toBe(201);
    expect(pushed.status).toBe(200);
    expect((pushed.body as { rejected?: unknown }).rejected ?? {}).toEqual({});
    expect((await storedDeck('my-deck')).title).toBe('Renamed');
    const importedId = sharedDeckImportSchema.parse(imported.body).deckId;
    const changes = (await pull(userB, cursor)).changes.user_decks;
    expect([...changes.created, ...changes.updated]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: importedId, visibility: 'private' }),
        expect.objectContaining({ id: 'my-deck', title: 'Renamed' }),
      ]),
    );
  });
});
