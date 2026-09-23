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
// This guard covers the fixture's own pools while they close. It cannot cover
// clients a test created, which is why teardown never terminates their backends.
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
  // One fixture at a time: vitest.sync.config.ts sets fileParallelism: false
  // and no Jest suite uses this fixture. Parallel runs would drop each other's
  // database here.
  const staleDatabases = await adminPool.query<{ datname: string }>(
    "SELECT datname FROM pg_database WHERE datname LIKE 'notanothercards_sync_%'",
  );
  for (const { datname } of staleDatabases.rows) {
    console.warn(`PostgreSQL setup: dropping stale test database ${datname}`);
    const escapedName = datname.replaceAll('"', '""');
    await adminPool.query(`DROP DATABASE "${escapedName}" WITH (FORCE)`);
  }
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
          throw new Error(
            `PostgreSQL teardown: ${remaining.rows.length} connection(s) to ${testDatabaseName} still open after 5 s; a test leaked a client. ${JSON.stringify(remaining.rows)}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await adminPool.query(`DROP DATABASE "${testDatabaseName}"`);
    } finally {
      await adminPool.end();
    }
  }
  adminPool = undefined;
  testDatabaseName = undefined;
  testConnectionString = undefined;
}
