import { describe, expect, it } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { Database, createDatabaseManager } from '@remelondb/core';
import {
  DatabaseProvider,
  useQuery,
  useDatabaseState,
} from '@remelondb/core/react';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import { schema, UserDeck, UserCard, ReviewEvent } from '@repo/offline-db';
import { getDecksQuery, createDeck } from '@repo/offline-db';

// Helper component that uses the real useQuery hook
function DecksTestComponent({ db }: { db: Database }) {
  const { status } = useDatabaseState();
  const { data: decks, isLoading } = useQuery(getDecksQuery(db));

  if (status !== 'ready' || isLoading) {
    return <div data-testid="status">Loading</div>;
  }

  return (
    <div>
      <div data-testid="status">{status}</div>
      <ul data-testid="decks-list">
        {decks?.map((deck) => (
          <li key={deck.id}>{deck.title}</li>
        ))}
      </ul>
    </div>
  );
}

describe('useQuery Integration Test', () => {
  it('reacts to database writes reactively using the real useQuery hook', async () => {
    // Open a real in-memory SQLite database
    const db = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: ':memory:',
    });

    const manager = createDatabaseManager({
      open: () => Promise.resolve(db),
    });

    await manager.init();

    render(
      <DatabaseProvider manager={manager}>
        <DecksTestComponent db={db} />
      </DatabaseProvider>,
    );

    // Initial check: status becomes ready and list is empty
    expect(await screen.findByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('decks-list').children).toHaveLength(0);

    // Perform a database write using the query helper
    await act(async () => {
      await createDeck(db, 'Integration Test Deck');
    });

    // Verify useQuery picked up the write reactively
    await waitFor(() => {
      expect(screen.getByTestId('decks-list').children).toHaveLength(1);
      expect(screen.getByText('Integration Test Deck')).toBeInTheDocument();
    });

    await db.driver.close();
  });
});
