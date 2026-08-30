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
import { Database, Q, synchronize } from '@remelondb/core';
import { syncSchemas } from '@remelondb/core/zod';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  ReviewEvent,
  ReviewEventRow,
  UserCard,
  UserCardRow,
  UserDeck,
  UserDeckRow,
  UserNote,
  UserNoteDeck,
  UserNoteDeckRow,
  UserNoteRow,
  UserProfile,
  UserProfileRow,
  migrations,
  schema,
} from '@repo/offline-db';
import {
  getTestConnectionString,
  hasPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

const describePostgres = hasPostgres ? describe : describe.skip;

const wire = syncSchemas({
  user_decks: UserDeckRow,
  user_notes: UserNoteRow,
  user_cards: UserCardRow,
  user_note_decks: UserNoteDeckRow,
  review_events: ReviewEventRow,
  user_profiles: UserProfileRow,
});

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

  const decks = (db: Database) =>
    db.get(UserDeck).query(Q.sortBy('created_at', Q.desc));

  it('converges two devices and scopes users apart', async () => {
    const cookie = await register('a');
    const a = await openClient();
    const b = await openClient();

    // create offline on A, converge on B
    const deck = await a.write(() =>
      a.get(UserDeck).create({
        user_id: 'local',
        deleted_at: null,
        title: 'E2E Spanish',
        description: 'made on device a',
        created_at: Date.now(),
        updated_at: Date.now(),
      }),
    );
    await syncClient(a, cookie);
    await syncClient(b, cookie);
    const onB = await decks(b).fetch();
    expect(onB.map((record) => record.title)).toEqual(['E2E Spanish']);

    // delete on B, tombstone reaches A
    await b.write(async () => {
      const found = await b.get(UserDeck).find(deck.id);
      await found.markAsDeleted();
    });
    await syncClient(b, cookie);
    await syncClient(a, cookie);
    expect(await decks(a).fetchCount()).toBe(0);

    // a second authenticated user pulls nothing
    const foreignCookie = await register('other');
    const c = await openClient();
    await syncClient(c, foreignCookie);
    expect(await decks(c).fetchCount()).toBe(0);
  }, 60_000);
});
