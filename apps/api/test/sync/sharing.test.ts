import type { INestApplication } from '@nestjs/common';
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
  sharedDeckListSchema,
  sharedDeckPreviewSchema,
  sharedDeckImportSchema,
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
import { SharingService } from '../../src/sharing/sharing.service';
import { publishedDecks } from '../../src/sharing/schema';
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
      truncate table published_decks, user_profiles, review_events, user_note_decks, user_cards, user_notes, user_decks cascade;
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

  it('publishes with a fresh revision the owner pulls, and republishes', async () => {
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
    expect(await db.select().from(publishedDecks)).toEqual([]);
    await post(userA, '/api/decks/retractable/publish').expect(200);
    expect(await db.select().from(publishedDecks)).toHaveLength(1);
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
        return { ok: true, flagged: [] };
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
          return { ok: true, flagged: [] };
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
        return { ok: true, flagged: [] };
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
      reason: 'refused',
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
        active: true,
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
          active: true,
          scheduledIntervalMinutes: 0,
        }),
      );
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
