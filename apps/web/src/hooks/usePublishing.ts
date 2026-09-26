import { useState } from 'react';
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
}

export function usePublishing() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [error, setError] = useState<ModerationError | null>(null);
  const [warnings, setWarnings] = useState<ModerationWarning[]>([]);

  const publish = async (
    deckId: string,
    onSync?: () => Promise<void>,
  ): Promise<boolean> => {
    setIsPublishing(true);
    setError(null);
    setWarnings([]);
    try {
      const published = await apiClient.publishing.publish(deckId);
      if (!published.published) {
        setError({
          action: 'publish',
          reason: published.refusal.reason || 'Moderation failed',
          flagged: published.refusal.flagged,
        });
        return false;
      }
      setWarnings(published.warnings);
      if (onSync) await onSync();
      return true;
    } catch (err) {
      setError({
        action: 'publish',
        reason: err instanceof Error ? err.message : 'Unknown error occurred',
        flagged: [],
      });
      return false;
    } finally {
      setIsPublishing(false);
    }
  };

  const unpublish = async (
    deckId: string,
    onSync?: () => Promise<void>,
  ): Promise<boolean> => {
    setIsUnpublishing(true);
    setError(null);
    try {
      await apiClient.publishing.unpublish(deckId);
      if (onSync) await onSync();
      setWarnings([]);
      return true;
    } catch (err) {
      setError({
        action: 'unpublish',
        reason: err instanceof Error ? err.message : 'Unknown error occurred',
        flagged: [],
      });
      return false;
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
  };
}
