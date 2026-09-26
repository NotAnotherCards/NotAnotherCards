import { useState } from 'react';
import type { SyncControllerState } from '@remelondb/core';
import { REJECTION_EXPLANATION } from '@repo/offline-db';
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

async function syncForPublishing(onSync?: () => Promise<SyncControllerState>) {
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
  if (state.lastResult.rejected > 0) {
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
  ): Promise<boolean> => {
    setIsPublishing(true);
    setError(null);
    setWarnings([]);
    let completed = false;
    try {
      await syncForPublishing(onSync);
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
      await syncForPublishing(onSync);
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
  ): Promise<boolean> => {
    setIsUnpublishing(true);
    setError(null);
    let completed = false;
    try {
      await syncForPublishing(onSync);
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
      await syncForPublishing(onSync);
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
