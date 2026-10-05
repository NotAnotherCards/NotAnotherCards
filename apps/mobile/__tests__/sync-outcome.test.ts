import type { Database, SyncControllerState } from '@remelondb/core';
import { syncFailure as syncError } from '@/lib/sync-outcome';
import { uiErrorText } from '@/lib/errors';
import { t } from 'i18next';
const syncFailure = async (...args: Parameters<typeof syncError>) => {
  const error = await syncError(...args);
  return error ? uiErrorText(error, t) : null;
};

const mockConcerns = jest.fn<Promise<boolean>, [unknown, string, unknown]>(() =>
  Promise.resolve(true),
);
jest.mock('@repo/offline-db', () => ({
  ...jest.requireActual<object>('@repo/offline-db'),
  rejectionsConcernDeck: (db: unknown, deckId: string, rejected: unknown) =>
    mockConcerns(db, deckId, rejected),
}));

const state = (over: Partial<SyncControllerState>): SyncControllerState => ({
  status: 'idle',
  lastSyncAt: 1,
  error: null,
  cause: null,
  lastResult: {
    lease: 'acquired',
    resynced: false,
    rejected: 0,
    rejectedRecords: {},
  },
  ...over,
});
const rejected = state({
  lastResult: {
    lease: 'acquired',
    resynced: false,
    rejected: 2,
    rejectedRecords: { user_cards: ['c1', 'c2'] },
  },
});

describe('syncFailure', () => {
  beforeEach(() => mockConcerns.mockClear());

  it('is null for a run that went through', async () => {
    expect(await syncFailure(state({}))).toBeNull();
  });

  it('names offline, errors, and rejected rows, which still end idle', async () => {
    expect(await syncFailure(state({ status: 'offline' }))).toBe(
      'You are offline.',
    );
    expect(
      await syncFailure(state({ status: 'error', error: 'Unauthorized' })),
    ).toBe('Your session has expired. Sign in again.');
    expect(await syncFailure(rejected)).toBe(
      'The server did not accept some of your changes.',
    );
  });

  it('never passes without a state, a result, or the lease', async () => {
    expect(await syncFailure(undefined)).toBe('Sync is unavailable.');
    expect(await syncFailure(state({ lastResult: null }))).toBe(
      'The sync could not be confirmed.',
    );
    expect(
      await syncFailure(
        state({
          lastResult: {
            lease: 'unavailable',
            resynced: false,
            rejected: 0,
            rejectedRecords: {},
          },
        }),
      ),
    ).toBe('The sync could not be confirmed.');
  });

  it("scoped to a deck, counts only that deck's refused rows", async () => {
    const db = {} as Database;
    mockConcerns.mockResolvedValueOnce(false);
    expect(await syncFailure(rejected, { db, deckId: 'd1' })).toBeNull();
    expect(mockConcerns).toHaveBeenCalledWith(db, 'd1', {
      user_cards: ['c1', 'c2'],
    });
    mockConcerns.mockResolvedValueOnce(true);
    expect(await syncFailure(rejected, { db, deckId: 'd1' })).toBe(
      'The server did not accept some of your changes.',
    );
  });
});
