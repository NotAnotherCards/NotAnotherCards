import 'dotenv/config';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import {
  databaseSchema,
  type AppDatabase,
} from '../../src/database/database-schema';

const baseConnectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

export const hasPostgres = Boolean(baseConnectionString);

let adminPool: Pool | undefined;
let testPool: Pool | undefined;
let testDatabaseName: string | undefined;
let testConnectionString: string | undefined;

export let db: AppDatabase;

export async function setUpPostgres(): Promise<void> {
  if (!baseConnectionString) return;

  const adminUrl = new URL(baseConnectionString);
  testDatabaseName = `notanothercards_sync_${process.pid}_${Date.now()}`;
  const targetUrl = new URL(baseConnectionString);
  targetUrl.pathname = `/${testDatabaseName}`;
  testConnectionString = targetUrl.toString();

  adminPool = new Pool({ connectionString: adminUrl.toString() });
  await adminPool.query(`CREATE DATABASE "${testDatabaseName}"`);

  testPool = new Pool({ connectionString: testConnectionString });
  db = drizzle(testPool, { schema: databaseSchema });
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
}

export async function resetPostgres(): Promise<void> {
  if (!testPool) return;

  await testPool.query(`
    truncate table review_events, user_cards, user_decks cascade;
    delete from remelon_revision_checkpoints;
    delete from remelon_sync_meta;
    delete from "user";
    alter sequence remelon_rev restart with 1;
    insert into "user" (
      id, name, username, timezone, email, email_verified, created_at, updated_at
    ) values
      ('user-a', 'User A', 'user-a', 'UTC', 'a@example.test', true, now(), now()),
      ('user-b', 'User B', 'user-b', 'UTC', 'b@example.test', true, now(), now());
  `);
}

export function getTestConnectionString(): string {
  if (!testConnectionString) throw new Error('PostgreSQL fixture is not ready');
  return testConnectionString;
}

export async function tearDownPostgres(): Promise<void> {
  await testPool?.end();
  testPool = undefined;

  if (adminPool && testDatabaseName) {
    await adminPool.query(`DROP DATABASE "${testDatabaseName}" WITH (FORCE)`);
    await adminPool.end();
  }
  adminPool = undefined;
  testDatabaseName = undefined;
  testConnectionString = undefined;
}
