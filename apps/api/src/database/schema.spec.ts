import { getTableConfig } from 'drizzle-orm/pg-core';
import { reviewEvents, userCards, userDecks } from '../sync/schema';

// Syncable tables must all follow the same timestamp convention:
// created_at is set once and never touched again, updated_at always
// holds the time of the last write.
describe.each([
  ['user_decks', userDecks],
  ['user_cards', userCards],
  ['review_events', reviewEvents],
])('%s remelonDB contract', (_name, table) => {
  it('uses client ids, server revisions, tombstones, and user scope', () => {
    expect(table.id.primary).toBe(true);
    expect(table.id.hasDefault).toBe(false);
    expect(table.rev.notNull).toBe(true);
    expect(table.rev.hasDefault).toBe(false);
    expect(table.deletedAt.notNull).toBe(false);
    expect(table.userId.notNull).toBe(true);
  });

  it('has the incremental-pull (user_id, rev) index', () => {
    const indexes = getTableConfig(table).indexes;
    const names: string[] = [];
    for (const tableIndex of indexes) names.push(tableIndex.config.name);
    expect(names).toContain(`${_name}_user_rev_idx`);
  });
});

it('enforces nonnegative safe-integer sync timestamps', () => {
  expect(
    getTableConfig(userDecks).checks.map((constraint) => constraint.name),
  ).toEqual([
    'user_decks_created_at_safe_integer_check',
    'user_decks_updated_at_safe_integer_check',
  ]);
  expect(
    getTableConfig(userCards).checks.map((constraint) => constraint.name),
  ).toEqual([
    'user_cards_due_at_safe_integer_check',
    'user_cards_created_at_safe_integer_check',
    'user_cards_updated_at_safe_integer_check',
  ]);
  expect(
    getTableConfig(reviewEvents).checks.map((constraint) => constraint.name),
  ).toEqual([
    'review_events_rating_check',
    'review_events_reviewed_at_safe_integer_check',
  ]);
});
