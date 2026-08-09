/**
 * The synced tables are declared twice: Zod rows in @repo/offline-db
 * (the wire and the clients) and Drizzle tables in src/sync/schema.ts
 * (Postgres). Both are hand-written and have drifted before (#55/#61:
 * card_type, context_sentence). This pins them together: every wire
 * field must be a column with matching nullability, and every column
 * must be either a wire field or known sync machinery.
 */
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ReviewEventRow, UserCardRow, UserDeckRow } from '@repo/offline-db';
import { reviewEvents, userCards, userDecks } from '../../src/sync/schema';

const CASES = [
  { name: 'user_decks', row: UserDeckRow, table: userDecks },
  { name: 'user_cards', row: UserCardRow, table: userCards },
  { name: 'review_events', row: ReviewEventRow, table: reviewEvents },
] as const;

// Owned by the server or the sync store, never on the wire: the engine
// carries ids separately, scope comes from auth, rev/deleted_at are the
// store's bookkeeping.
const MACHINERY = new Set(['id', 'rev', 'deleted_at', 'user_id']);

describe.each(CASES)('parity: $name', ({ name, row, table }) => {
  const columns = Object.values(getTableColumns(table));
  const byDbName = new Map(columns.map((column) => [column.name, column]));

  it('every wire field is a column with matching nullability', () => {
    for (const [key, field] of Object.entries(row.shape)) {
      const column = byDbName.get(key);
      expect(
        column,
        `${name}.${key} is on the wire but not in Postgres`,
      ).toBeDefined();
      const wireNullable = (field as z.ZodType).safeParse(null).success;
      const pgNullable = !column!.notNull;
      expect(
        pgNullable,
        `${name}.${key}: wire says ${wireNullable ? 'nullable' : 'required'}, Postgres says ${pgNullable ? 'nullable' : 'not null'}`,
      ).toBe(wireNullable);
    }
  });

  it('every column is a wire field or known machinery', () => {
    const wireKeys = new Set(Object.keys(row.shape));
    const unaccounted = columns
      .map((column) => column.name)
      .filter((dbName) => !wireKeys.has(dbName) && !MACHINERY.has(dbName));
    expect(
      unaccounted,
      `${name}: columns invisible to the wire (add to the row schema or to MACHINERY): ${unaccounted.join(', ')}`,
    ).toEqual([]);
  });
});
