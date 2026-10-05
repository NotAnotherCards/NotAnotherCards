import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { Database, SyncControllerState } from '@remelondb/core';
import { rejectionsConcernDeck } from '@repo/offline-db';
import { type ModerationWarning } from '@repo/schemas';
import { apiClient } from '@/lib/api-client';

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
  t: (key: string, options?: Record<string, unknown>) => string,
  onSync?: () => Promise<SyncControllerState>,
  db?: Database | null,
) {
  if (!onSync) throw new Error(t('deck.moderation.sync_unavailable'));
  const state = await onSync();
  if (
    (state.status !== 'idle' && state.status !== 'resync-required') ||
    !state.lastResult
  ) {
    throw new Error(state.error || t('deck.moderation.sync_incomplete'));
  }
  // With the database shared between tabs only one of them syncs at a
  // time; a run another tab locked out transferred nothing, and its zero
  // rejections say nothing. The other tab keeps the lease for as long as
  // it keeps syncing, so there is no wait after which a retry is sure to
  // get it: say so and let the user try again.
  if (state.lastResult.lease === 'unavailable') {
    throw new Error(t('deck.moderation.sync_busy'));
  }
  // 'lost' (the lease was taken during the run) or absent: nothing says
  // the changes arrived.
  if (state.lastResult.lease !== 'acquired') {
    throw new Error(t('deck.moderation.sync_unconfirmed'));
  }
  const { rejected, rejectedRecords } = state.lastResult;
  if (
    rejected > 0 &&
    (!db || (await rejectionsConcernDeck(db, deckId, rejectedRecords)))
  ) {
    throw new Error(
      t('deck.moderation.changes_rejected', {
        explanation: t('mobile.messages.sync_details'),
      }),
    );
  }
}

export function usePublishing() {
  const { t } = useTranslation();
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
      await syncForPublishing(deckId, t, onSync, db);
      const published = await apiClient.publishing.publish(deckId);
      if (!published.published) {
        setError({
          action: 'publish',
          reason: published.refusal.reason || t('deck.moderation.failed'),
          flagged: published.refusal.flagged,
        });
        return false;
      }
      setWarnings(published.warnings);
      completed = true;
      setRemoteVisibility({ deckId, visibility: 'public' });
      await syncForPublishing(deckId, t, onSync, db);
      return true;
    } catch (err) {
      setError({
        action: 'publish',
        reason: err instanceof Error ? err.message : t('common.unknown_error'),
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
      await syncForPublishing(deckId, t, onSync, db);
      await apiClient.publishing.unpublish(deckId);
      completed = true;
      setRemoteVisibility({ deckId, visibility: 'private' });
      setWarnings([]);
      await syncForPublishing(deckId, t, onSync, db);
      return true;
    } catch (err) {
      setError({
        action: 'unpublish',
        reason: err instanceof Error ? err.message : t('common.unknown_error'),
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
