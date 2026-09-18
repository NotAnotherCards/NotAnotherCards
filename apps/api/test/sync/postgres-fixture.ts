import 'dotenv/config';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import {
  databaseSchema,
  type AppDatabase,
} from '../../src/database/database-schema';

const baseConnectionString = process.env.TEST_DATABASE_URL;

export const hasPostgres = Boolean(baseConnectionString);

let adminPool: Pool | undefined;
let testPool: Pool | undefined;
let testDatabaseName: string | undefined;
let testConnectionString: string | undefined;
let tearingDown = false;

export let db: AppDatabase;

// Teardown waits for server-side connections to close before a normal drop.
// Keep this pool-level guard for errors during the forced-cleanup fallback;
// it cannot catch errors on clients that no longer forward to this pool.
// Pool errors outside teardown must still fail the run.
function absorbTeardownErrors(pool: Pool): Pool {
  pool.on('error', (error) => {
    if (!tearingDown) throw error;
  });
  return pool;
}

export async function setUpPostgres(): Promise<void> {
  if (!baseConnectionString) return;

  tearingDown = false;

  const adminUrl = new URL(baseConnectionString);
  testDatabaseName = `notanothercards_sync_${process.pid}_${Date.now()}`;
  const targetUrl = new URL(baseConnectionString);
  targetUrl.pathname = `/${testDatabaseName}`;
  testConnectionString = targetUrl.toString();

  adminPool = absorbTeardownErrors(
    new Pool({ connectionString: adminUrl.toString() }),
  );
  await adminPool.query(`CREATE DATABASE "${testDatabaseName}"`);

  testPool = absorbTeardownErrors(
    new Pool({ connectionString: testConnectionString }),
  );
  db = drizzle(testPool, { schema: databaseSchema });
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
}

export async function resetPostgres(): Promise<void> {
  if (!testPool) return;

  await testPool.query(`
    truncate table daily_challenge_completions, badge_awards, deck_takedowns, deck_reports, published_decks, user_profiles, review_events, user_note_decks, user_cards, user_notes, user_decks, ai_generation_jobs, ai_usage cascade;
    delete from remelon_revision_checkpoints;
    delete from remelon_sync_meta;
    delete from "user";
    alter sequence remelon_rev restart with 1;
    insert into "user" (
      id, name, timezone, email, email_verified, created_at, updated_at
    ) values
      ('user-a', 'User A', 'UTC', 'a@example.test', true, now(), now()),
      ('user-b', 'User B', 'UTC', 'b@example.test', true, now(), now());
  `);
}

export function getTestConnectionString(): string {
  if (!testConnectionString) throw new Error('PostgreSQL fixture is not ready');
  return testConnectionString;
}

export async function tearDownPostgres(): Promise<void> {
  tearingDown = true;

  await testPool?.end();
  testPool = undefined;

  if (adminPool && testDatabaseName) {
    try {
      // Pool.end() can resolve before PostgreSQL has closed its backends.
      // Include connections from pools owned by Nest and individual tests.
      const deadline = performance.now() + 5_000;
      let force = false;
      for (;;) {
        const { rows } = await adminPool.query<{ count: string }>(
          'SELECT count(*) FROM pg_stat_activity WHERE datname = $1',
          [testDatabaseName],
        );
        if (Number(rows[0].count) === 0) break;
        if (performance.now() >= deadline) {
          const remaining = await adminPool.query(
            `SELECT pid, application_name, state, backend_start, state_change,
                    wait_event_type, wait_event
             FROM pg_stat_activity WHERE datname = $1`,
            [testDatabaseName],
          );
          console.warn(
            `PostgreSQL teardown timed out waiting for connections to ${testDatabaseName}; forcing cleanup`,
            remaining.rows,
          );
          await adminPool.query(
            'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1',
            [testDatabaseName],
          );
          force = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await adminPool.query(
        `DROP DATABASE "${testDatabaseName}"${force ? ' WITH (FORCE)' : ''}`,
      );
    } finally {
      await adminPool.end();
    }
  }
  adminPool = undefined;
  testDatabaseName = undefined;
  testConnectionString = undefined;
}
