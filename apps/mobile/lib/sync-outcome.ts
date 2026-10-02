import type { Database, SyncControllerState } from '@remelondb/core';
import { rejectionsConcernDeck } from '@repo/offline-db';

// What a finished sync means for an action that waited for it: null when
// the run went through, otherwise why the server may not have the latest
// data. `idle` alone is not enough: a run that held no lease transferred
// nothing, and rejected rows stay on the device while the run still ends
// idle. With a deck to scope to, only that deck's refused rows count, as
// web's publishing does; without one, any refusal does. No state at all
// (no controller) is a failure too, never a pass.
export async function syncFailure(
  state: SyncControllerState | undefined,
  scope?: { db: Database; deckId: string },
): Promise<string | null> {
  if (!state) return 'Sync is unavailable.';
  if (state.status === 'offline') return 'You are offline.';
  if (state.status === 'error') return state.error ?? 'The sync failed.';
  const result = state.lastResult;
  if (
    (state.status !== 'idle' && state.status !== 'resync-required') ||
    !result ||
    result.lease !== 'acquired'
  ) {
    return 'The sync could not be confirmed.';
  }
  if (result.rejected > 0) {
    const concerns = scope
      ? await rejectionsConcernDeck(
          scope.db,
          scope.deckId,
          result.rejectedRecords,
        )
      : true;
    if (concerns) return 'The server did not accept some of your changes.';
  }
  return null;
}
