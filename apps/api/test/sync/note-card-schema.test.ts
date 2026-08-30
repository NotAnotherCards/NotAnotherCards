import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  db,
  hasPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('note/card PostgreSQL migration', () => {
  beforeAll(setUpPostgres, 30_000);
  afterAll(tearDownPostgres, 30_000);

  it('creates notes, generated cards, and note-level deck memberships', async () => {
    const result = await db.execute<{
      table_name: string;
      column_name: string;
      is_nullable: 'YES' | 'NO';
      data_type: string;
      column_default: string | null;
    }>(`
      select table_name, column_name, is_nullable, data_type, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('user_notes', 'user_cards', 'user_note_decks')
    `);

    const columns = new Map(
      result.rows.map((column) => [
        `${column.table_name}.${column.column_name}`,
        column,
      ]),
    );

    expect(columns.get('user_notes.fields_json')?.is_nullable).toBe('NO');
    expect(columns.get('user_cards.note_id')?.is_nullable).toBe('NO');
    expect(columns.get('user_cards.template_key')?.is_nullable).toBe('NO');
    expect(columns.get('user_cards.active')?.is_nullable).toBe('NO');
    expect(columns.get('user_cards.scheduled_interval_minutes')).toMatchObject({
      is_nullable: 'NO',
      data_type: 'integer',
      column_default: '0',
    });
    expect(columns.has('user_cards.deck_id')).toBe(false);
    expect(columns.get('user_note_decks.note_id')?.is_nullable).toBe('NO');
    expect(columns.get('user_note_decks.deck_id')?.is_nullable).toBe('NO');
    expect(columns.get('user_note_decks.active')?.is_nullable).toBe('NO');
  });

  it('enforces the scheduled interval range', async () => {
    const result = await db.execute<{
      constraint_name: string;
      definition: string;
    }>(`
      select conname as constraint_name, pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conrelid = 'user_cards'::regclass
        and contype = 'c'
    `);
    const constraint = result.rows.find(
      (row) =>
        row.constraint_name ===
        'user_cards_scheduled_interval_minutes_range_check',
    );

    expect(constraint?.definition).toMatch(
      /scheduled_interval_minutes\s*>=\s*0/i,
    );
    expect(constraint?.definition).toMatch(
      /scheduled_interval_minutes\s*<=\s*172800/i,
    );
  });

  it('creates the incremental-pull and relationship indexes', async () => {
    const result = await db.execute<{ indexname: string }>(`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename in ('user_notes', 'user_cards', 'user_note_decks')
    `);
    const indexes = new Set(result.rows.map((row) => row.indexname));

    expect([...indexes]).toEqual(
      expect.arrayContaining([
        'user_notes_user_rev_idx',
        'user_cards_user_rev_idx',
        'user_cards_note_idx',
        'user_cards_user_due_idx',
        'user_note_decks_user_rev_idx',
        'user_note_decks_note_idx',
        'user_note_decks_deck_idx',
      ]),
    );
  });
});
