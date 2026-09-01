import { desc, lte, sql } from 'drizzle-orm';
import type { AppDatabase } from '../database/database-schema';
import { remelonRevisionCheckpoints } from './schema';
import type { AppSyncStore } from './sync-store';

export const DEFAULT_TOMBSTONE_RETENTION_DAYS = 90;

export interface TombstoneGcOptions {
  db: AppDatabase;
  store: AppSyncStore;
  now?: Date;
  retentionDays?: number;
}

export interface TombstoneGcResult {
  checkpointRev: number;
  floor: number | null;
  cutoff: Date;
}

export async function runTombstoneGc({
  db,
  store,
  now = new Date(),
  retentionDays = DEFAULT_TOMBSTONE_RETENTION_DAYS,
}: TombstoneGcOptions): Promise<TombstoneGcResult> {
  if (!Number.isFinite(retentionDays) || retentionDays < 0) {
    throw new Error(`Invalid tombstone retention: ${retentionDays} days`);
  }

  const current = await db.execute<{ rev: string | number }>(sql`
    select greatest(
      coalesce((select max(rev) from user_decks), 0),
      coalesce((select max(rev) from user_notes), 0),
      coalesce((select max(rev) from user_cards), 0),
      coalesce((select max(rev) from user_note_decks), 0),
      coalesce((select max(rev) from review_events), 0),
      coalesce((select max(rev) from user_profiles), 0),
      coalesce((select value from remelon_sync_meta where key = 'gc_floor'), 0)
    ) as rev
  `);
  const checkpointRev = Number(current.rows[0]?.rev ?? 0);

  await db
    .insert(remelonRevisionCheckpoints)
    .values({ observedAt: now, rev: checkpointRev })
    .onConflictDoUpdate({
      target: remelonRevisionCheckpoints.observedAt,
      set: { rev: checkpointRev },
    });

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const [eligible] = await db
    .select({ rev: remelonRevisionCheckpoints.rev })
    .from(remelonRevisionCheckpoints)
    .where(lte(remelonRevisionCheckpoints.observedAt, cutoff))
    .orderBy(desc(remelonRevisionCheckpoints.observedAt))
    .limit(1);

  if (!eligible) {
    return { checkpointRev, floor: null, cutoff };
  }

  await store.gc(eligible.rev);
  return { checkpointRev, floor: eligible.rev, cutoff };
}
