import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  cardId,
  noteDeckId,
} from '@repo/offline-db';
import {
  moderationRefusalSchema,
  sharedDeckListSchema,
  sharedDeckPreviewSchema,
} from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
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

  const previousEnvironment = {
    databaseUrl: process.env.DATABASE_URL,
    frontendUrl: process.env.FRONTEND_URL,
    authSecret: process.env.BETTER_AUTH_SECRET,
    authUrl: process.env.BETTER_AUTH_URL,
    moderationAllowAll: process.env.MODERATION_ALLOW_ALL,
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
      noteType: BASIC_NOTE_TYPE,
      visibility,
      createdAt: now,
      updatedAt: now,
    });
    if (cards === 0) return { deckId, noteIds, cardIds: [] };

    await db.insert(userNotes).values(
      noteIds.map((noteId, index) => ({
        id: noteId,
        rev: sql`nextval('remelon_rev')`,
        userId: owner.id,
        noteType: BASIC_NOTE_TYPE,
        fieldsVersion: BASIC_NOTE_FIELDS_VERSION,
        fieldsJson: JSON.stringify({
          front: `front ${index}`,
          back: `back ${index}`,
        }),
        additionalContent: null,
        createdAt: now + index,
        updatedAt: now + index,
      })),
    );
    await db.insert(userCards).values(
      noteIds.map((noteId, index) => ({
        id: cardId(noteId, BASIC_FRONT_BACK_TEMPLATE_KEY),
        rev: sql`nextval('remelon_rev')`,
        userId: owner.id,
        noteId,
        templateKey: BASIC_FRONT_BACK_TEMPLATE_KEY,
        front: `front ${index}`,
        back: `back ${index}`,
        dueAt: now,
        createdAt: now + index,
        updatedAt: now + index,
      })),
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

    return {
      deckId,
      noteIds,
      cardIds: noteIds.map((noteId) =>
        cardId(noteId, BASIC_FRONT_BACK_TEMPLATE_KEY),
      ),
    };
  };

  const storedDeck = async (deckId: string) =>
    (await db.select().from(userDecks).where(eq(userDecks.id, deckId)))[0];

  const post = (user: TestUser, path: string) =>
    request(app.getHttpServer()).post(path).set('Cookie', user.cookie);

  const get = (user: TestUser, path: string) =>
    request(app.getHttpServer()).get(path).set('Cookie', user.cookie);

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

  beforeAll(async () => {
    await setUpPostgres();
    process.env.DATABASE_URL = getTestConnectionString();
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.MODERATION_ALLOW_ALL = '1';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(db)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    await app.init();

    userA = await signUp('sharing-user-a');
    userB = await signUp('sharing-user-b');
  }, 30_000);

  beforeEach(async () => {
    await db.execute(`
      truncate table user_profiles, review_events, user_note_decks, user_cards, user_notes, user_decks cascade;
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
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.MODERATION_ALLOW_ALL = '1';
  });

  afterAll(async () => {
    await app?.close();
    await tearDownPostgres();

    process.env.DATABASE_URL = previousEnvironment.databaseUrl;
    process.env.FRONTEND_URL = previousEnvironment.frontendUrl;
    process.env.BETTER_AUTH_SECRET = previousEnvironment.authSecret;
    process.env.BETTER_AUTH_URL = previousEnvironment.authUrl;
    process.env.MODERATION_ALLOW_ALL = previousEnvironment.moderationAllowAll;
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

  it('publishes with a fresh revision the owner pulls, and repeats without writing', async () => {
    await seedDeck(userA, 'publishable');
    const before = await storedDeck('publishable');
    const start = await pull(userA);

    const response = await post(userA, '/api/decks/publishable/publish').expect(
      200,
    );
    expect(response.body).toEqual({ visibility: 'public' });

    const published = await storedDeck('publishable');
    expect(published.visibility).toBe('public');
    expect(published.rev).toBeGreaterThan(before.rev);

    const changes = (await pull(userA, start.cursor)).changes.user_decks;
    expect([...changes.created, ...changes.updated]).toEqual([
      expect.objectContaining({ id: 'publishable', visibility: 'public' }),
    ]);

    await post(userA, '/api/decks/publishable/publish').expect(200);
    expect((await storedDeck('publishable')).rev).toBe(published.rev);
  });

  it('refuses a deck the moderator flags and names the offending card', async () => {
    const { cardIds } = await seedDeck(userA, 'flagged', { cards: 2 });
    const before = await storedDeck('flagged');
    const check = vi
      .spyOn(app.get(ModerationService), 'check')
      .mockResolvedValue({
        ok: false,
        flagged: [{ cardId: cardIds[1], reason: 'slur' }],
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

  it('refuses to publish where moderation is not switched on', async () => {
    await seedDeck(userA, 'unchecked');
    const before = await storedDeck('unchecked');
    delete process.env.MODERATION_ALLOW_ALL;

    const response = await post(userA, '/api/decks/unchecked/publish').expect(
      422,
    );
    expect(response.body).toEqual({
      reason: 'moderation unavailable',
      flagged: [],
    });
    expect(await storedDeck('unchecked')).toEqual(before);
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

  it('paginates and refuses a limit outside the allowed range', async () => {
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

    await get(userA, '/api/shared/decks?limit=101').expect(400);
    await get(userA, '/api/shared/decks?limit=nope').expect(400);
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
});
