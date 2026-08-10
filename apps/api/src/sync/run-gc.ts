import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseSchema, type AppDatabase } from '../database/database-schema';
import { runTombstoneGc } from './retention';
import { createAppSyncStore } from './sync-store';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool, { schema: databaseSchema }) as AppDatabase;
    const result = await runTombstoneGc({
      db,
      store: createAppSyncStore(db),
    });
    console.log(
      result.floor === null
        ? `Recorded revision ${result.checkpointRev}; no checkpoint is old enough for GC.`
        : `Recorded revision ${result.checkpointRev}; garbage-collected through revision ${result.floor}.`,
    );
  } finally {
    await pool.end();
  }
}

void main();
