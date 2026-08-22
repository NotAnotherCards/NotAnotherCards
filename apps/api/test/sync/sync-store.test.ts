import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
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
import { userProfiles } from '../../src/sync/schema';
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

const allTablesCreated = (now: number, suffix = '1'): SyncChanges => ({
  user_decks: {
    created: [
      {
        id: `deck-${suffix}`,
        title: `Private deck ${suffix}`,
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
        id: `card-${suffix}`,
        deck_id: `deck-${suffix}`,
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
        id: `review-${suffix}`,
        user_card_id: `card-${suffix}`,
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
  it('enforces unique profile usernames but permits multiple null usernames', async () => {
    const now = Date.now();
    await db.insert(userProfiles).values([
      {
        userId: 'user-a',
        rev: 1,
        username: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: 'user-b',
        rev: 2,
        username: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db
      .update(userProfiles)
      .set({ username: 'shared-name' })
      .where(eq(userProfiles.userId, 'user-a'));
    await expect(
      db
        .update(userProfiles)
        .set({ username: 'shared-name' })
        .where(eq(userProfiles.userId, 'user-b')),
    ).rejects.toMatchObject({
      cause: {
        code: '23505',
        constraint: 'user_profiles_username_unique',
      },
    });
  });

  it('round-trips a one-to-one profile and rejects a foreign profile id', async () => {
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    const profile = {
      username: 'alice',
      bio: 'Learning German',
      avatar_file_id: null,
      native_language_id: null,
      target_language_id: null,
      created_at: now,
      updated_at: now,
    };

    const result = accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: {
          user_profiles: {
            created: [
              { id: 'user-a', ...profile },
              { id: 'user-b', ...profile, username: 'not-alice' },
            ],
            updated: [],
            deleted: [],
          },
        },
      }),
    );

    expect(result.rejected?.user_profiles).toEqual(['user-b']);
    const state = pulled(await handlers.pull(pullArgs(null)));
    expect(state.changes.user_profiles?.updated).toEqual([
      expect.objectContaining({ id: 'user-a', username: 'alice' }),
    ]);
  });

  it('rejects duplicate profile usernames and accepts later valid profile syncs', async () => {
    const now = Date.now();
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const userA = engine.as('user-a');
    const userB = engine.as('user-b');
    const profile = (username: string | null, updatedAt: number) => ({
      username,
      bio: null,
      avatar_file_id: null,
      native_language_id: null,
      target_language_id: null,
      created_at: now,
      updated_at: updatedAt,
    });

    const startA = pulled(await userA.pull(pullArgs(null)));
    const startB = pulled(await userB.pull(pullArgs(null)));
    const nullA = accepted(
      await userA.push({
        cursor: startA.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-a', ...profile(null, now) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );
    const nullB = accepted(
      await userB.push({
        cursor: startB.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-b', ...profile(null, now) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );

    expect(nullA.rejected?.user_profiles ?? []).toEqual([]);
    expect(nullB.rejected?.user_profiles ?? []).toEqual([]);

    const namedA = accepted(
      await userA.push({
        cursor: nullA.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-a', ...profile('alice', now + 1) }],
            deleted: [],
          },
        },
      }),
    );
    const unchangedA = accepted(
      await userA.push({
        cursor: namedA.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-a', ...profile('alice', now + 2) }],
            deleted: [],
          },
        },
      }),
    );

    expect(unchangedA.rejected?.user_profiles ?? []).toEqual([]);

    const duplicateB = accepted(
      await userB.push({
        cursor: nullB.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-b', ...profile('alice', now + 3) }],
            deleted: [],
          },
        },
      }),
    );

    expect(duplicateB.rejected?.user_profiles).toEqual(['user-b']);
    const afterRejection = accepted(
      await userB.push({
        cursor: duplicateB.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-b', ...profile('bob', now + 4) }],
            deleted: [],
          },
        },
      }),
    );

    expect(afterRejection.rejected?.user_profiles ?? []).toEqual([]);
    const profiles = await db
      .select({ userId: userProfiles.userId, username: userProfiles.username })
      .from(userProfiles);
    expect(profiles).toEqual(
      expect.arrayContaining([
        { userId: 'user-a', username: 'alice' },
        { userId: 'user-b', username: 'bob' },
      ]),
    );
  });

  it('releases a username when the profile is tombstoned', async () => {
    const now = Date.now();
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const userA = engine.as('user-a');
    const userB = engine.as('user-b');
    const profile = (username: string | null, updatedAt: number) => ({
      username,
      bio: null,
      avatar_file_id: null,
      native_language_id: null,
      target_language_id: null,
      created_at: now,
      updated_at: updatedAt,
    });

    const startA = pulled(await userA.pull(pullArgs(null)));
    const createdA = accepted(
      await userA.push({
        cursor: startA.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-a', ...profile('alice', now) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );
    expect(createdA.rejected?.user_profiles ?? []).toEqual([]);

    const deletedA = accepted(
      await userA.push({
        cursor: createdA.cursor!,
        changes: {
          user_profiles: { created: [], updated: [], deleted: ['user-a'] },
        },
      }),
    );
    expect(deletedA.rejected?.user_profiles ?? []).toEqual([]);

    // scrub blanks username in the same stroke as the tombstone, so the
    // unique constraint stops holding the name
    const [tombstoned] = await db
      .select({
        username: userProfiles.username,
        deletedAt: userProfiles.deletedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, 'user-a'));
    expect(tombstoned?.username).toBeNull();
    expect(tombstoned?.deletedAt).not.toBeNull();

    const startB = pulled(await userB.pull(pullArgs(null)));
    const claimedB = accepted(
      await userB.push({
        cursor: startB.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-b', ...profile('alice', now + 1) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );

    expect(claimedB.rejected?.user_profiles ?? []).toEqual([]);
    const [ownerB] = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(userProfiles.userId, 'user-b'));
    expect(ownerB?.username).toBe('alice');
  });

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

  it('round-trips card updates while preserving insert-only creation time', async () => {
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_cards: {
            created: [],
            updated: [
              {
                id: 'card-1',
                deck_id: 'deck-1',
                front: 'updated front',
                back: 'updated back',
                due_at: now + 10_000,
                created_at: now + 20_000,
                updated_at: now + 30_000,
              },
            ],
            deleted: [],
          },
        },
      }),
    );

    const incremental = pulled(await handlers.pull(pullArgs(seeded.cursor)));
    expect(incremental.changes.user_cards?.updated).toEqual([
      expect.objectContaining({
        id: 'card-1',
        front: 'updated front',
        back: 'updated back',
        due_at: now + 10_000,
        created_at: now,
        updated_at: now + 30_000,
      }),
    ]);
  });

  it('isolates every configured table between two user scopes', async () => {
    const now = Date.now();
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const userA = engine.as('user-a');
    const userB = engine.as('user-b');
    const startA = pulled(await userA.pull(pullArgs(null)));
    const startB = pulled(await userB.pull(pullArgs(null)));

    accepted(
      await userA.push({
        cursor: startA.cursor,
        changes: allTablesCreated(now, 'a'),
      }),
    );
    accepted(
      await userB.push({
        cursor: startB.cursor,
        changes: allTablesCreated(now + 1, 'b'),
      }),
    );

    const stateA = pulled(await userA.pull(pullArgs(null)));
    const stateB = pulled(await userB.pull(pullArgs(null)));
    expect(stateA.changes.user_decks?.updated.map((row) => row.id)).toEqual([
      'deck-a',
    ]);
    expect(stateA.changes.user_cards?.updated.map((row) => row.id)).toEqual([
      'card-a',
    ]);
    expect(stateA.changes.review_events?.updated.map((row) => row.id)).toEqual([
      'review-a',
    ]);
    expect(stateB.changes.user_decks?.updated.map((row) => row.id)).toEqual([
      'deck-b',
    ]);
    expect(stateB.changes.user_cards?.updated.map((row) => row.id)).toEqual([
      'card-b',
    ]);
    expect(stateB.changes.review_events?.updated.map((row) => row.id)).toEqual([
      'review-b',
    ]);

    const rejected = accepted(
      await userB.push({
        cursor: stateB.cursor,
        changes: {
          user_decks: {
            created: [],
            updated: [
              {
                id: 'deck-a',
                title: 'stolen deck',
                description: null,
                created_at: now,
                updated_at: now + 2,
              },
            ],
            deleted: [],
          },
          user_cards: {
            created: [],
            updated: [
              {
                id: 'card-a',
                deck_id: 'deck-a',
                front: 'stolen front',
                back: 'stolen back',
                due_at: now,
                created_at: now,
                updated_at: now + 2,
              },
            ],
            deleted: [],
          },
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
      }),
    );
    expect(rejected.rejected).toEqual({
      user_decks: ['deck-a'],
      user_cards: ['card-a'],
      review_events: ['review-a'],
    });

    const unchangedA = pulled(await userA.pull(pullArgs(null)));
    expect(unchangedA.changes.user_decks?.updated[0]).toEqual(
      expect.objectContaining({ id: 'deck-a', title: 'Private deck a' }),
    );
    expect(unchangedA.changes.user_cards?.updated[0]).toEqual(
      expect.objectContaining({ id: 'card-a', front: 'secret front' }),
    );
    expect(unchangedA.changes.review_events?.updated[0]).toEqual(
      expect.objectContaining({ id: 'review-a', rating: 3 }),
    );
  });

  it('rejects review updates instead of silently ignoring them', async () => {
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const result = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          review_events: {
            created: [],
            updated: [
              {
                id: 'review-1',
                user_card_id: 'card-1',
                rating: 1,
                reviewed_at: now,
              },
            ],
            deleted: [],
          },
        },
      }),
    );

    expect(result.rejected?.review_events).toEqual(['review-1']);
    const state = pulled(await handlers.pull(pullArgs(null)));
    expect(state.changes.review_events?.updated).toEqual([
      expect.objectContaining({ id: 'review-1', rating: 3 }),
    ]);
  });

  it('cascades a deck tombstone to its active cards and reviews', async () => {
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(Date.now()),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const result = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
        },
      }),
    );

    expect(result.changes?.user_cards?.deleted).toEqual(['card-1']);
    expect(result.changes?.review_events?.deleted).toEqual(['review-1']);
    const rows = await db.execute<{ table_name: string; deleted: boolean }>(`
      select 'user_decks' as table_name, deleted_at is not null as deleted
      from user_decks where id = 'deck-1'
      union all
      select 'user_cards', deleted_at is not null
      from user_cards where id = 'card-1'
      union all
      select 'review_events', deleted_at is not null
      from review_events where id = 'review-1'
    `);
    expect(rows.rows).toEqual([
      { table_name: 'user_decks', deleted: true },
      { table_name: 'user_cards', deleted: true },
      { table_name: 'review_events', deleted: true },
    ]);
  });

  it('cascades a card tombstone to its review events', async () => {
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(Date.now()),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const result = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_cards: { created: [], updated: [], deleted: ['card-1'] },
        },
      }),
    );

    expect(result.changes?.review_events?.deleted).toEqual(['review-1']);
    const rows = await db.execute<{
      deck_active: boolean;
      card_deleted: boolean;
      review_deleted: boolean;
    }>(`
      select
        d.deleted_at is null as deck_active,
        c.deleted_at is not null as card_deleted,
        r.deleted_at is not null as review_deleted
      from user_decks d
      join user_cards c on c.deck_id = d.id
      join review_events r on r.user_card_id = c.id
      where d.id = 'deck-1'
    `);
    expect(rows.rows[0]).toEqual({
      deck_active: true,
      card_deleted: true,
      review_deleted: true,
    });
  });

  it('rejects a parent delete combined with child creates or updates', async () => {
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const contradictory = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
          user_cards: {
            created: [
              {
                id: 'card-2',
                deck_id: 'deck-1',
                front: 'new front',
                back: 'new back',
                due_at: now,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [
              {
                id: 'card-1',
                deck_id: 'deck-1',
                front: 'updated front',
                back: 'updated back',
                due_at: now,
                created_at: now,
                updated_at: now + 1,
              },
            ],
            deleted: [],
          },
        },
      }),
    );

    expect(contradictory.rejected).toEqual({ user_decks: ['deck-1'] });
    const active = await db.execute<{
      deck_active: boolean;
      active_cards: string;
      updated_front: string;
    }>(`
      select
        d.deleted_at is null as deck_active,
        count(c.id) filter (where c.deleted_at is null)::text as active_cards,
        max(c.front) filter (where c.id = 'card-1') as updated_front
      from user_decks d
      left join user_cards c on c.deck_id = d.id
      where d.id = 'deck-1'
      group by d.id
    `);
    expect(active.rows[0]).toEqual({
      deck_active: true,
      active_cards: '2',
      updated_front: 'updated front',
    });

    const retry = accepted(
      await handlers.push({
        cursor: contradictory.cursor!,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
        },
      }),
    );
    expect(new Set(retry.changes?.user_cards?.deleted)).toEqual(
      new Set(['card-1', 'card-2']),
    );
    expect(retry.changes?.review_events?.deleted).toEqual(['review-1']);
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
    const revisionsBeforeDelete = await db.execute<{
      table_name: string;
      rev: string;
    }>(`
      select 'user_decks' as table_name, rev::text from user_decks where id = 'deck-1'
      union all
      select 'user_cards', rev::text from user_cards where id = 'card-1'
      union all
      select 'review_events', rev::text from review_events where id = 'review-1'
    `);

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
      table_name: string;
      rev: string;
      deleted_at: Date | null;
      title: string | null;
      description: string | null;
      front: string | null;
      back: string | null;
    }>(`
      select
        'user_decks' as table_name,
        rev::text,
        deleted_at,
        title,
        description,
        null::text as front,
        null::text as back
      from user_decks where id = 'deck-1'
      union all
      select
        'user_cards', rev::text, deleted_at, null, null, front, back
      from user_cards where id = 'card-1'
      union all
      select
        'review_events', rev::text, deleted_at, null, null, null, null
      from review_events where id = 'review-1'
    `);
    expect(rows.rows).toHaveLength(3);
    expect(rows.rows.every((row) => row.deleted_at !== null)).toBe(true);
    const previousRevs = new Map(
      revisionsBeforeDelete.rows.map((row) => [
        row.table_name,
        Number(row.rev),
      ]),
    );
    for (const row of rows.rows) {
      expect(Number(row.rev)).toBeGreaterThan(
        previousRevs.get(row.table_name) ?? 0,
      );
    }
    expect(
      rows.rows.find((row) => row.table_name === 'user_decks'),
    ).toMatchObject({
      title: '',
      description: null,
    });
    expect(
      rows.rows.find((row) => row.table_name === 'user_cards'),
    ).toMatchObject({
      front: '',
      back: '',
    });
  });

  it('persists a time-based GC floor and expires older cursors', async () => {
    const { store, crossValidateChanges } = createAppSyncStore(db);
    const handlers = createAppSyncEngine({ store, crossValidateChanges }).as(
      'user-a',
    );
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

    const remainingRows = await db.execute<{ count: string }>(`
      select sum(count)::text as count
      from (
        select count(*) from user_decks
        union all
        select count(*) from user_cards
        union all
        select count(*) from review_events
      ) synced_rows
    `);
    expect(Number(remainingRows.rows[0]?.count)).toBe(0);
  });

  it('rolls back every row when a push cannot be committed', async () => {
    const { store: durableStore, crossValidateChanges } =
      createAppSyncStore(db);
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
    const handlers = createAppSyncEngine({
      store: failingStore,
      crossValidateChanges,
    }).as('user-a');
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
