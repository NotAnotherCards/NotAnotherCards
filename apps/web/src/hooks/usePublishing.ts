import { useState } from 'react';
import { moderationRefusalSchema, apiErrorBodySchema } from '@repo/schemas';

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

  const publish = async (
    deckId: string,
    onSync?: () => Promise<void>,
  ): Promise<boolean> => {
    setIsPublishing(true);
    setError(null);
    try {
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
      if (onSync) await onSync();
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

  return { publish, unpublish, isPublishing, isUnpublishing, error, setError };
}
