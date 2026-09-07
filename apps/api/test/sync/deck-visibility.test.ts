import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { accepted, pulled } from '@remelondb/server/conformance';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { syncWireSchemas } from '@repo/offline-db';
import { userDecks } from '../../src/sync/schema';
import {
  createAppSyncEngine,
  createAppSyncStore,
} from '../../src/sync/sync-store';
import {
  db,
  hasPostgres,
  resetPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

const deck = (id: string, visibility = 'private') => ({
  id,
  title: 'Deck',
  description: null,
  note_type: 'basic',
  native_language_id: null,
  target_language_id: null,
  visibility,
  created_at: 1,
  updated_at: 1,
});
const pullArgs = (cursor: string | null = null) => ({
  cursor,
  schemaVersion: 1,
  migration: null,
});

describe('deck visibility wire contract', () => {
  it.each(['private', 'public'])('accepts %s', (visibility) => {
    expect(
      syncWireSchemas.rows.user_decks.safeParse(deck('deck', visibility))
        .success,
    ).toBe(true);
  });
  it.each(['friends', '', null, undefined])(
    'rejects invalid or missing visibility: %s',
    (visibility) => {
      expect(
        syncWireSchemas.rows.user_decks.safeParse({
          ...deck('deck'),
          visibility,
        }).success,
      ).toBe(false);
    },
  );
});

(hasPostgres ? describe : describe.skip)(
  'deck visibility sync and PostgreSQL',
  () => {
    beforeAll(setUpPostgres, 30_000);
    beforeEach(resetPostgres);
    afterAll(tearDownPostgres, 30_000);

    async function context() {
      const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
      const start = pulled(await handlers.pull(pullArgs()));
      const push = async (
        created: Record<string, unknown>[] = [],
        updated: Record<string, unknown>[] = [],
      ) => {
        const current = pulled(await handlers.pull(pullArgs()));
        return accepted(
          await handlers.push({
            cursor: current.cursor,
            changes: { user_decks: { created, updated, deleted: [] } },
          }),
        );
      };
      return { handlers, start, push };
    }

    it('rejects public creates by id while applying private rows in the same batch', async () => {
      const { push, handlers } = await context();
      const result = await push([deck('forbidden', 'public'), deck('allowed')]);
      expect(result.rejected?.user_decks).toEqual(['forbidden']);
      const resultPull = pulled(await handlers.pull(pullArgs()));
      const changes = resultPull.changes.user_decks;
      expect([
        ...(changes?.created ?? []),
        ...(changes?.updated ?? []),
      ]).toEqual([deck('allowed')]);
    });

    it('rejects a private-to-public update without changing the stored row', async () => {
      const { push } = await context();
      await push([deck('private')]);
      const result = await push(
        [],
        [{ ...deck('private', 'public'), title: 'Rejected edit' }],
      );
      expect(result.rejected?.user_decks).toEqual(['private']);
      expect(await db.select().from(userDecks)).toEqual([
        expect.objectContaining({
          id: 'private',
          visibility: 'private',
          title: 'Deck',
        }),
      ]);
    });

    it('allows unchanged public and unpublish, but rejects a stale public push afterwards', async () => {
      const { push, handlers, start } = await context();
      await push([deck('published')]);
      // Publication is server-owned; its endpoint/revision handling belongs to #260.
      await db
        .update(userDecks)
        .set({ visibility: 'public' })
        .where(eq(userDecks.id, 'published'));
      expect(
        (await push([], [deck('published', 'public')])).rejected?.user_decks ??
          [],
      ).toEqual([]);
      const beforeUnpublish = (await db.select().from(userDecks))[0].rev;
      const stale = pulled(await handlers.pull(pullArgs()));
      expect(
        (await push([], [deck('published')])).rejected?.user_decks ?? [],
      ).toEqual([]);
      expect((await db.select().from(userDecks))[0].rev).toBeGreaterThan(
        beforeUnpublish,
      );
      const changes = pulled(await handlers.pull(pullArgs(start.cursor)))
        .changes.user_decks;
      expect([
        ...(changes?.created ?? []),
        ...(changes?.updated ?? []),
      ]).toEqual([deck('published')]);
      expect(
        await handlers.push({
          cursor: stale.cursor,
          changes: {
            user_decks: {
              created: [],
              updated: [deck('published', 'public')],
              deleted: [],
            },
          },
        }),
      ).toEqual({ conflict: true });
      // Even after refreshing its cursor, a client cannot resend stale public content.
      expect(
        (await push([], [deck('published', 'public')])).rejected?.user_decks,
      ).toEqual(['published']);
      expect((await db.select().from(userDecks))[0].visibility).toBe('private');
    });

    it('does not let another user preserve or unpublish someone else’s public deck', async () => {
      const { push } = await context();
      await push([deck('owned')]);
      await db
        .update(userDecks)
        .set({ visibility: 'public' })
        .where(eq(userDecks.id, 'owned'));
      const other = createAppSyncEngine(createAppSyncStore(db)).as('user-b');
      const start = pulled(await other.pull(pullArgs()));
      for (const visibility of ['public', 'private']) {
        const result = accepted(
          await other.push({
            cursor: start.cursor,
            changes: {
              user_decks: {
                created: [],
                updated: [deck('owned', visibility)],
                deleted: [],
              },
            },
          }),
        );
        expect(result.rejected?.user_decks).toEqual(['owned']);
      }
      expect((await db.select().from(userDecks))[0].visibility).toBe('public');
    });

    it('rejects invalid and older-client rows without blocking a valid sibling', async () => {
      const { push } = await context();
      const legacy: Record<string, unknown> = deck('legacy');
      delete legacy.visibility;
      const result = await push([
        legacy,
        deck('invalid', 'friends'),
        deck('valid'),
      ]);
      expect(result.rejected?.user_decks).toEqual(
        expect.arrayContaining(['legacy', 'invalid']),
      );
      expect(await db.select({ id: userDecks.id }).from(userDecks)).toEqual([
        { id: 'valid' },
      ]);
    });

    it('backfills existing decks and enforces the database default and constraints', async () => {
      const migration = await readFile(
        resolve('drizzle/0012_abnormal_raider.sql'),
        'utf8',
      );
      await db.transaction(async (tx) => {
        await tx.execute(sql.raw('CREATE SCHEMA visibility_migration_test'));
        await tx.execute(
          sql.raw('SET LOCAL search_path TO visibility_migration_test, public'),
        );
        await tx.execute(
          sql.raw('CREATE TABLE user_decks (id text primary key)'),
        );
        await tx.execute(
          sql.raw("INSERT INTO user_decks (id) VALUES ('existing')"),
        );
        for (const statement of migration.split('--> statement-breakpoint'))
          await tx.execute(sql.raw(statement));
        await tx.execute(sql.raw("INSERT INTO user_decks (id) VALUES ('new')"));
        expect(
          (
            await tx.execute(
              sql.raw('SELECT visibility FROM user_decks ORDER BY id'),
            )
          ).rows,
        ).toEqual([{ visibility: 'private' }, { visibility: 'private' }]);
        await tx.execute(
          sql.raw('DROP SCHEMA visibility_migration_test CASCADE'),
        );
      });
      for (const visibility of ['friends', null]) {
        await expect(
          db.insert(userDecks).values({
            id: 'invalid',
            userId: 'user-a',
            rev: 1,
            title: 'Deck',
            noteType: 'basic',
            createdAt: 1,
            updatedAt: 1,
            visibility: visibility as string,
          }),
        ).rejects.toThrow();
      }
    });
  },
);
