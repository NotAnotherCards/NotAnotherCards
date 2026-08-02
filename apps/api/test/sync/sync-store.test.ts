import { drizzle } from 'drizzle-orm/node-postgres';
import type {
  SyncChanges,
  SyncPullResult,
  SyncPushArgs,
} from '@remelondb/core';
import {
  accepted,
  pulled,
  registerServerConformance,
} from '@remelondb/server/conformance';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  databaseSchema,
  type AppDatabase,
} from '../../src/database/database-schema';
import { runTombstoneGc } from '../../src/sync/retention';
import {
  createAppSyncEngine,
  createAppSyncStore,
  type AppSyncStore,
} from '../../src/sync/sync-store';
import {
  db,
  getTestConnectionString,
  hasPostgres,
  resetPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

const pullArgs = (cursor: string | null) => ({
  cursor,
  schemaVersion: 1,
  migration: null,
});

let nextId = 0;
const id = (prefix: string): string => `${prefix}-${++nextId}`;

if (hasPostgres) {
  beforeAll(setUpPostgres, 30_000);
  beforeEach(resetPostgres);
  afterAll(tearDownPostgres, 30_000);

  registerServerConformance({
    name: 'NotAnotherCards PostgreSQL Drizzle store',
    makeContext: () => {
      const engine = createAppSyncEngine(createAppSyncStore(db));
      return Promise.resolve({
        handlers: engine.as('user-a'),
        secondUser: engine.as('user-b'),
        concurrently: async (
          pull: () => Promise<SyncPullResult>,
          write: () => Promise<void>,
        ) => {
          const pulling = pull();
          await write();
          return pulling;
        },
      });
    },
    fixtures: {
      user_decks: {
        validRow: () => ({
          id: id('deck'),
          title: 'German',
          description: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        }),
        mutate: (row) => ({
          ...row,
          title: `${String(row.title)} edited`,
          updated_at: Date.now(),
        }),
        invalidRow: () => ({
          id: id('invalid-deck'),
          title: '',
          description: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        }),
      },
    },
  });
} else {
  describe.skip('PostgreSQL remelonDB sync integration', () => {
    it('requires DATABASE_URL or TEST_DATABASE_URL', () => undefined);
  });
}

const allTablesCreated = (now: number): SyncChanges => ({
  user_decks: {
    created: [
      {
        id: 'deck-1',
        title: 'Private deck',
        description: 'Sensitive description',
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
        id: 'card-1',
        deck_id: 'deck-1',
        front: 'secret front',
        back: 'secret back',
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
        id: 'review-1',
        user_card_id: 'card-1',
        rating: 3,
        reviewed_at: now,
      },
    ],
    updated: [],
    deleted: [],
  },
});

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('PostgreSQL-backed sync behavior', () => {
  it('round-trips all tables and persists through a fresh backend instance', async () => {
    const now = Date.now();
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const handlers = engine.as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));

    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );

    const anotherPool = new Pool({
      connectionString: getTestConnectionString(),
    });
    try {
      const restartedDb = drizzle(anotherPool, {
        schema: databaseSchema,
      }) as AppDatabase;
      const restarted = createAppSyncEngine(createAppSyncStore(restartedDb)).as(
        'user-a',
      );
      const state = pulled(await restarted.pull(pullArgs(null)));

      expect(state.changes.user_decks?.updated).toEqual([
        expect.objectContaining({ id: 'deck-1', created_at: now }),
      ]);
      expect(state.changes.user_cards?.updated).toEqual([
        expect.objectContaining({ id: 'card-1', due_at: now }),
      ]);
      expect(state.changes.review_events?.updated).toEqual([
        expect.objectContaining({ id: 'review-1', reviewed_at: now }),
      ]);
    } finally {
      await anotherPool.end();
    }
  });

  it('stores deletes as scrubbed tombstones and serves them incrementally', async () => {
    const store = createAppSyncStore(db);
    const handlers = createAppSyncEngine(store).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(Date.now()),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
          user_cards: { created: [], updated: [], deleted: ['card-1'] },
          review_events: {
            created: [],
            updated: [],
            deleted: ['review-1'],
          },
        },
      }),
    );

    const incremental = pulled(await handlers.pull(pullArgs(seeded.cursor)));
    expect(incremental.changes.user_decks?.deleted).toEqual(['deck-1']);
    expect(incremental.changes.user_cards?.deleted).toEqual(['card-1']);
    expect(incremental.changes.review_events?.deleted).toEqual(['review-1']);

    const rows = await db.execute<{
      title: string;
      description: string | null;
      front: string;
      back: string;
    }>(`
      select d.title, d.description, c.front, c.back
      from user_decks d cross join user_cards c
      where d.id = 'deck-1' and c.id = 'card-1'
    `);
    expect(rows.rows[0]).toMatchObject({
      title: '',
      description: null,
      front: '',
      back: '',
    });
  });

  it('persists a time-based GC floor and expires older cursors', async () => {
    const store = createAppSyncStore(db);
    const handlers = createAppSyncEngine(store).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(Date.now()),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
          user_cards: { created: [], updated: [], deleted: ['card-1'] },
          review_events: {
            created: [],
            updated: [],
            deleted: ['review-1'],
          },
        },
      }),
    );

    const firstRun = await runTombstoneGc({
      db,
      store,
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(firstRun.floor).toBeNull();

    const secondRun = await runTombstoneGc({
      db,
      store,
      now: new Date('2026-04-02T00:00:00Z'),
    });
    expect(secondRun.floor).not.toBeNull();
    expect(await handlers.pull(pullArgs(seeded.cursor))).toEqual({
      resyncRequired: true,
    });

    const meta = await db.execute<{ value: string }>(
      `select value from remelon_sync_meta where key = 'gc_floor'`,
    );
    expect(Number(meta.rows[0]?.value)).toBe(secondRun.floor);
  });

  it('rolls back every row when a push cannot be committed', async () => {
    const durableStore = createAppSyncStore(db);
    const failingStore: AppSyncStore = {
      gc: (floor) => durableStore.gc(floor),
      transaction: (scope, mode, work) =>
        durableStore.transaction(scope, mode, (tx) =>
          work({
            ...tx,
            upsert: async (table, txScope, rows) => {
              await tx.upsert(table, txScope, rows);
              throw new Error('simulated database failure');
            },
          }),
        ),
    };
    const handlers = createAppSyncEngine(failingStore).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    const push: SyncPushArgs = {
      cursor: start.cursor,
      changes: {
        user_decks: allTablesCreated(Date.now()).user_decks,
      },
    };

    await expect(handlers.push(push)).rejects.toThrow(
      'simulated database failure',
    );
    const rows = await db.execute<{ count: string }>(
      `select count(*) as count from user_decks`,
    );
    expect(Number(rows.rows[0]?.count)).toBe(0);
  });
});
