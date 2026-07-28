import { userCards, userDecks } from './schema';

// Syncable tables must all follow the same timestamp convention:
// created_at is set once and never touched again, updated_at always
// holds the time of the last write.
describe.each([
  ['user_decks', userDecks],
  ['user_cards', userCards],
])('%s timestamp convention', (_name, table) => {
  it('updated_at is NOT NULL, defaults to now() and refreshes on update', () => {
    expect(table.updatedAt.notNull).toBe(true);
    expect(table.updatedAt.hasDefault).toBe(true);
    expect(table.updatedAt.onUpdateFn).toBeDefined();
  });

  it('created_at is immutable after insert', () => {
    expect(table.createdAt.notNull).toBe(true);
    expect(table.createdAt.hasDefault).toBe(true);
    expect(table.createdAt.onUpdateFn).toBeUndefined();
  });
});
