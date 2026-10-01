import { useState } from 'react';
import type { Database, SyncControllerState } from '@remelondb/core';
import { REJECTION_EXPLANATION, rejectionsConcernDeck } from '@repo/offline-db';
import {
  moderationRefusalSchema,
  apiErrorBodySchema,
  publishResponseSchema,
  type ModerationWarning,
} from '@repo/schemas';

export interface FlaggedCard {
  cardId: string;
  reason: string;
}

export interface ModerationError {
  action: 'publish' | 'unpublish';
  reason: string;
  flagged: FlaggedCard[];
  completed?: boolean;
}

// Publishing acts on what the server holds, so the deck's local changes must
// be there first. A refused row of another deck is not this deck's problem;
// without a database to tell, a refusal blocks.
async function syncForPublishing(
  deckId: string,
  onSync?: () => Promise<SyncControllerState>,
  db?: Database | null,
) {
  if (!onSync)
    throw new Error('Sync is unavailable. Please try again when connected.');
  const state = await onSync();
  if (
    (state.status !== 'idle' && state.status !== 'resync-required') ||
    !state.lastResult
  ) {
    throw new Error(
      state.error || 'Sync did not complete. Please try again when connected.',
    );
  }
  // With the database shared between tabs only one of them syncs at a
  // time; a run another tab locked out transferred nothing, and its zero
  // rejections say nothing. The other tab keeps the lease for as long as
  // it keeps syncing, so there is no wait after which a retry is sure to
  // get it: say so and let the user try again.
  if (state.lastResult.lease === 'unavailable') {
    throw new Error(
      'Another tab is syncing right now. Please try again in a moment.',
    );
  }
  // 'lost' (the lease was taken during the run) or absent: nothing says
  // the changes arrived.
  if (state.lastResult.lease !== 'acquired') {
    throw new Error('Sync could not be confirmed. Please try again.');
  }
  const { rejected, rejectedRecords } = state.lastResult;
  if (
    rejected > 0 &&
    (!db || (await rejectionsConcernDeck(db, deckId, rejectedRecords)))
  ) {
    throw new Error(
      `The deck's changes were not accepted by the server. ${REJECTION_EXPLANATION}`,
    );
  }
}

export function usePublishing() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [error, setError] = useState<ModerationError | null>(null);
  const [warnings, setWarnings] = useState<ModerationWarning[]>([]);
  const [remoteVisibility, setRemoteVisibility] = useState<{
    deckId: string;
    visibility: 'public' | 'private';
  } | null>(null);

  const publish = async (
    deckId: string,
    onSync?: () => Promise<SyncControllerState>,
    db?: Database | null,
  ): Promise<boolean> => {
    setIsPublishing(true);
    setError(null);
    setWarnings([]);
    let completed = false;
    try {
      await syncForPublishing(deckId, onSync, db);
      const res = await fetch(
        `/api/decks/${encodeURIComponent(deckId)}/publish`,
        {
          method: 'POST',
        },
      );
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        if (res.status === 422) {
          const body = moderationRefusalSchema.safeParse(json);
          if (body.success) {
            setError({
              action: 'publish',
              reason: body.data.reason || 'Moderation failed',
              flagged: body.data.flagged || [],
            });
            return false;
          }
        }
        const errorBody = apiErrorBodySchema.parse(json);
        throw new Error(errorBody.message || 'Failed to publish deck');
      }
      const published = publishResponseSchema.parse(await res.json());
      setWarnings(published.warnings);
      completed = true;
      setRemoteVisibility({ deckId, visibility: 'public' });
      await syncForPublishing(deckId, onSync, db);
      return true;
    } catch (err) {
      setError({
        action: 'publish',
        reason: err instanceof Error ? err.message : 'Unknown error occurred',
        flagged: [],
        completed,
      });
      return completed;
    } finally {
      setIsPublishing(false);
    }
  };

  const unpublish = async (
    deckId: string,
    onSync?: () => Promise<SyncControllerState>,
    db?: Database | null,
  ): Promise<boolean> => {
    setIsUnpublishing(true);
    setError(null);
    let completed = false;
    try {
      await syncForPublishing(deckId, onSync, db);
      const res = await fetch(
        `/api/decks/${encodeURIComponent(deckId)}/unpublish`,
        {
          method: 'POST',
        },
      );
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const errorBody = apiErrorBodySchema.parse(json);
        throw new Error(errorBody.message || 'Failed to unpublish deck');
      }
      completed = true;
      setRemoteVisibility({ deckId, visibility: 'private' });
      setWarnings([]);
      await syncForPublishing(deckId, onSync, db);
      return true;
    } catch (err) {
      setError({
        action: 'unpublish',
        reason: err instanceof Error ? err.message : 'Unknown error occurred',
        flagged: [],
        completed,
      });
      return completed;
    } finally {
      setIsUnpublishing(false);
    }
  };

  return {
    publish,
    unpublish,
    isPublishing,
    isUnpublishing,
    error,
    setError,
    warnings,
    remoteVisibility,
    setRemoteVisibility,
  };
}
