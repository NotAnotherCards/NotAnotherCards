/**
 * Local writes in useStore schedule a sync (#52); reads do not.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { Database, createDatabaseManager } from '@remelondb/core';
import { DatabaseProvider } from '@remelondb/core/react';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  schema,
  UserDeck,
  UserNote,
  UserCard,
  UserNoteDeck,
  ReviewEvent,
} from '@repo/offline-db';
import { useStore } from '@/hooks/useStore';
import { SyncProvider } from '@/offline/syncProvider';
import type { SyncController } from '@/offline/syncController';

describe('useStore sync triggers', () => {
  it('notifies after deck and card writes, but not deletion summaries', async () => {
    const db = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserNote, UserCard, UserNoteDeck, ReviewEvent],
      name: ':memory:',
    });
    const manager = createDatabaseManager({
      open: () => Promise.resolve(db),
    });
    await manager.init();

    const notifyLocalWrite = vi.fn();
    const controller = {
      state: { status: 'idle', lastSyncAt: null, error: null },
      subscribe: () => () => {},
      start: () => {},
      notifyLocalWrite,
      syncNow: () => {},
      dispose: () => {},
    } as unknown as SyncController;

    const { result } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={manager}>
          <SyncProvider controller={controller}>{children}</SyncProvider>
        </DatabaseProvider>
      ),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      const deck = await result.current.createDeck('Deck', 'desc');
      await result.current.updateDeck(deck.id, 'Deck 2', 'desc');
      const card = await result.current.createCard(deck.id, 'front', 'back');
      await result.current.updateCard(card.id, 'front 2', 'back 2');
      await result.current.recordReview(card.id, 2);
      await result.current.removeNoteFromDeck(card.note_id, deck.id);
      await result.current.deleteNote(card.note_id);
      await result.current.deleteDeck(deck.id);
      const secondDeck = await result.current.createDeck('Second deck', '');
      await result.current.createCard(secondDeck.id, 'front', 'back');
      const countBeforeRead = notifyLocalWrite.mock.calls.length;
      expect(
        (await result.current.deckDeletionSummary(secondDeck.id))
          .orphanedCardCount,
      ).toBe(1);
      expect(notifyLocalWrite).toHaveBeenCalledTimes(countBeforeRead);
      await result.current.deleteDeckWithNotes(secondDeck.id);
    });

    expect(notifyLocalWrite).toHaveBeenCalledTimes(11);
    await db.driver.close();
  });
});
