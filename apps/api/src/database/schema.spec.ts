import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  reviewEvents,
  userCards,
  userDecks,
  userNoteDecks,
  userNotes,
  userProfiles,
} from '../sync/schema';

// Syncable tables must all follow the same timestamp convention:
// created_at is set once and never touched again, updated_at always
// holds the time of the last write.
describe.each([
  ['user_decks', userDecks],
  ['user_notes', userNotes],
  ['user_cards', userCards],
  ['user_note_decks', userNoteDecks],
  ['review_events', reviewEvents],
  ['user_profiles', userProfiles],
])('%s remelonDB contract', (_name, table) => {
  it('uses client ids, server revisions, tombstones, and user scope', () => {
    const id = 'id' in table ? table.id : table.userId;
    expect(id.primary).toBe(true);
    expect(id.hasDefault).toBe(false);
    expect(table.rev.notNull).toBe(true);
    expect(table.rev.hasDefault).toBe(false);
    expect(table.deletedAt.notNull).toBe(false);
    expect(table.userId.notNull).toBe(true);
  });

  it('has the incremental-pull (user_id, rev) index', () => {
    const indexes = getTableConfig(table).indexes;
    const names: string[] = [];
    for (const tableIndex of indexes)
      if (tableIndex.config.name) names.push(tableIndex.config.name);
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
    getTableConfig(userNotes).checks.map((constraint) => constraint.name),
  ).toEqual([
    'user_notes_created_at_safe_integer_check',
    'user_notes_updated_at_safe_integer_check',
  ]);
  expect(
    getTableConfig(userCards).checks.map((constraint) => constraint.name),
  ).toEqual([
    'user_cards_due_at_safe_integer_check',
    'user_cards_scheduled_interval_minutes_range_check',
    'user_cards_created_at_safe_integer_check',
    'user_cards_updated_at_safe_integer_check',
  ]);
  expect(
    getTableConfig(userNoteDecks).checks.map((constraint) => constraint.name),
  ).toEqual([
    'user_note_decks_created_at_safe_integer_check',
    'user_note_decks_updated_at_safe_integer_check',
  ]);
  expect(
    getTableConfig(reviewEvents).checks.map((constraint) => constraint.name),
  ).toEqual([
    'review_events_rating_check',
    'review_events_reviewed_at_safe_integer_check',
  ]);
  expect(
    getTableConfig(userProfiles).checks.map((constraint) => constraint.name),
  ).toEqual([
    'user_profiles_created_at_safe_integer_check',
    'user_profiles_updated_at_safe_integer_check',
  ]);
});

it('defines the note/card/deck-membership model', () => {
  expect(userCards.noteId.notNull).toBe(true);
  expect(userCards.templateKey.notNull).toBe(true);
  expect('deckId' in userCards).toBe(false);
  expect(userCards.active.notNull).toBe(true);
  expect(userCards.active.hasDefault).toBe(true);
  expect(userCards.scheduledIntervalMinutes.getSQLType()).toBe('integer');
  expect(userCards.scheduledIntervalMinutes.notNull).toBe(true);
  expect(userCards.scheduledIntervalMinutes.hasDefault).toBe(true);
  expect(userCards.scheduledIntervalMinutes.default).toBe(0);
  expect(userNoteDecks.active.notNull).toBe(true);
  expect(userNoteDecks.active.hasDefault).toBe(true);

  const cardIndexes = getTableConfig(userCards).indexes.map(
    (tableIndex) => tableIndex.config.name,
  );
  expect(cardIndexes).toContain('user_cards_note_idx');
  expect(cardIndexes).toContain('user_cards_user_due_idx');

  const membershipIndexes = getTableConfig(userNoteDecks).indexes.map(
    (tableIndex) => tableIndex.config.name,
  );
  expect(membershipIndexes).toContain('user_note_decks_note_idx');
  expect(membershipIndexes).toContain('user_note_decks_deck_idx');
});

it('keeps profile usernames globally unique while allowing them to be unset', () => {
  expect(userProfiles.username.isUnique).toBe(true);
  expect(userProfiles.username.uniqueName).toBe(
    'user_profiles_username_unique',
  );
  expect(userProfiles.username.notNull).toBe(false);
});
