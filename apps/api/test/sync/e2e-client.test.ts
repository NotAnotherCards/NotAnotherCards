/**
 * The wire, end to end: two real remelonDB clients (node driver,
 * in-memory SQLite) synchronize through the real HTTP endpoints of the
 * booted app, authenticated by a real Better Auth session. The server
 * suite proves the engine; the client suite upstream proves sync
 * against a fake server; this is the only place both halves meet.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, Q, randomId, synchronize } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  ReviewEvent,
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
  UserProfile,
  cardId,
  migrations,
  noteDeckId,
  schema,
  syncWireSchemas,
} from '@repo/offline-db';
import {
  getTestConnectionString,
  hasPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

const describePostgres = hasPostgres ? describe : describe.skip;

const wire = syncWireSchemas;

describePostgres('client-server sync, end to end', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    await setUpPostgres();
    process.env.DATABASE_URL = getTestConnectionString();
    process.env.BETTER_AUTH_SECRET ??= 'e2e-only-secret';
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    process.env.FRONTEND_URL ??= 'http://localhost:5173';
    process.env.GOOGLE_CLIENT_ID = 'dummy-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'dummy-google-client-secret';
    process.env.FACEBOOK_CLIENT_ID = 'dummy-facebook-client-id';
    process.env.FACEBOOK_CLIENT_SECRET = 'dummy-facebook-client-secret';
    // import after the env is in place: the app reads it at module init
    const { AppModule } = (await import('../../src/app.module.js')) as {
      AppModule: new () => unknown;
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    const server = app.getHttpServer() as import('node:http').Server;
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await tearDownPostgres();
  });

  const openClient = () =>
    Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      migrations,
      modelClasses: [
        UserDeck,
        UserNote,
        UserCard,
        UserNoteDeck,
        ReviewEvent,
        UserProfile,
      ],
      name: ':memory:',
    });

  const register = async (tag: string): Promise<string> => {
    const response = await fetch(`${base}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `E2E ${tag}`,
        email: `e2e-${tag}-${Date.now()}@example.com`,
        password: 'e2e-password-1',
      }),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((entry) => entry.split(';')[0])
      .join('; ');
    expect(cookie.length).toBeGreaterThan(0);
    return cookie;
  };

  const syncClient = (db: Database, cookie: string) =>
    synchronize({
      database: db,
      pullChanges: async (args) => {
        const response = await fetch(`${base}/sync/pull`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify(args),
        });
        expect(response.status, await response.clone().text()).toBe(200);
        return wire.pullResult.parse(await response.json());
      },
      pushChanges: async (args) => {
        const response = await fetch(`${base}/sync/push`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify(args),
        });
        expect(response.status, await response.clone().text()).toBe(200);
        return wire.pushResult.parse(await response.json());
      },
    });

  it('converges the note model, schedules, cascades, and user scopes', async () => {
    const cookie = await register('a');
    const a = await openClient();
    const b = await openClient();
    const now = Date.now();
    const deckId = randomId();
    const noteId = randomId();
    const userCardId = cardId(noteId, BASIC_FRONT_BACK_TEMPLATE_KEY);
    const membershipId = noteDeckId(noteId, deckId);
    const reviewId = randomId();

    await a.write(async () => {
      await a.batch([
        a.get(UserDeck).prepareCreate({
          id: deckId,
          title: 'E2E Spanish',
          description: 'made on device a',
          note_type: BASIC_NOTE_TYPE,
          native_language_id: null,
          target_language_id: null,
          created_at: now,
          updated_at: now,
        }),
        a.get(UserNote).prepareCreate({
          id: noteId,
          note_type: BASIC_NOTE_TYPE,
          fields_version: BASIC_NOTE_FIELDS_VERSION,
          fields_json: JSON.stringify({ front: 'hola', back: 'hello' }),
          additional_content: 'A complete synced note',
          created_at: now,
          updated_at: now,
        }),
        a.get(UserCard).prepareCreate({
          id: userCardId,
          note_id: noteId,
          template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
          active: true,
          front: 'hola',
          back: 'hello',
          due_at: now,
          scheduled_interval_minutes: 30,
          created_at: now,
          updated_at: now,
        }),
        a.get(UserNoteDeck).prepareCreate({
          id: membershipId,
          note_id: noteId,
          deck_id: deckId,
          active: true,
          created_at: now,
          updated_at: now,
        }),
        a.get(ReviewEvent).prepareCreate({
          id: reviewId,
          user_card_id: userCardId,
          rating: 3,
          reviewed_at: now,
        }),
      ]);
    });

    await syncClient(a, cookie);
    await syncClient(b, cookie);
    expect((await b.get(UserDeck).find(deckId)).title).toBe('E2E Spanish');
    expect((await b.get(UserNote).find(noteId)).fields_json).toBe(
      JSON.stringify({ front: 'hola', back: 'hello' }),
    );
    expect(await b.get(UserCard).find(userCardId)).toMatchObject({
      note_id: noteId,
      scheduled_interval_minutes: 30,
      due_at: now,
    });
    expect(await b.get(UserNoteDeck).find(membershipId)).toMatchObject({
      note_id: noteId,
      deck_id: deckId,
      active: true,
    });
    expect(await b.get(ReviewEvent).find(reviewId)).toMatchObject({
      user_card_id: userCardId,
      rating: 3,
    });

    const updatedDueAt = now + 90 * 60_000;
    await b.write(async () => {
      const card = await b.get(UserCard).find(userCardId);
      await card.update((record) => {
        record.due_at = updatedDueAt;
        record.scheduled_interval_minutes = 90;
        record.updated_at = now + 1;
      });
    });
    await syncClient(b, cookie);
    await syncClient(a, cookie);
    expect(await a.get(UserCard).find(userCardId)).toMatchObject({
      due_at: updatedDueAt,
      scheduled_interval_minutes: 90,
    });

    await b.write(async () => {
      const found = await b.get(UserDeck).find(deckId);
      await found.markAsDeleted();
    });
    await syncClient(b, cookie);
    await syncClient(a, cookie);
    for (const client of [a, b]) {
      expect(
        await client.get(UserDeck).query(Q.where('id', deckId)).fetchCount(),
      ).toBe(0);
      expect(
        await client
          .get(UserNoteDeck)
          .query(Q.where('id', membershipId))
          .fetchCount(),
      ).toBe(0);
      expect(await client.get(UserNote).find(noteId)).toBeDefined();
      expect(await client.get(UserCard).find(userCardId)).toMatchObject({
        due_at: updatedDueAt,
        scheduled_interval_minutes: 90,
      });
      expect(await client.get(ReviewEvent).find(reviewId)).toBeDefined();
    }

    await b.write(async () => {
      const note = await b.get(UserNote).find(noteId);
      await note.markAsDeleted();
    });
    await syncClient(b, cookie);
    await syncClient(a, cookie);
    for (const client of [a, b]) {
      expect(
        await client.get(UserNote).query(Q.where('id', noteId)).fetchCount(),
      ).toBe(0);
      expect(
        await client
          .get(UserCard)
          .query(Q.where('id', userCardId))
          .fetchCount(),
      ).toBe(0);
      expect(
        await client
          .get(UserNoteDeck)
          .query(Q.where('id', membershipId))
          .fetchCount(),
      ).toBe(0);
      expect(
        await client
          .get(ReviewEvent)
          .query(Q.where('id', reviewId))
          .fetchCount(),
      ).toBe(0);
    }

    const foreignCookie = await register('other');
    const c = await openClient();
    await syncClient(c, foreignCookie);
    expect(await c.get(UserDeck).query().fetchCount()).toBe(0);
    expect(await c.get(UserNote).query().fetchCount()).toBe(0);
    expect(await c.get(UserCard).query().fetchCount()).toBe(0);
    expect(await c.get(UserNoteDeck).query().fetchCount()).toBe(0);
    expect(await c.get(ReviewEvent).query().fetchCount()).toBe(0);
  }, 60_000);
});
