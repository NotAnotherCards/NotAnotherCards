import { useState } from 'react';

export interface FlaggedCard {
  cardId: string;
  reason: string;
}

export interface ModerationError {
  reason: string;
  flagged: FlaggedCard[];
}

export function usePublishing() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [error, setError] = useState<ModerationError | null>(null);

  const publish = async (deckId: string): Promise<boolean> => {
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
        const body = await res.json().catch(() => null);
        if (res.status === 422 && body) {
          setError({
            reason: body.reason || 'Moderation failed',
            flagged: body.flagged || [],
          });
          return false;
        }
        throw new Error(body?.message || 'Failed to publish deck');
      }
      return true;
    } catch (err) {
      setError({
        reason: err instanceof Error ? err.message : 'Unknown error occurred',
        flagged: [],
      });
      return false;
    } finally {
      setIsPublishing(false);
    }
  };

  const unpublish = async (deckId: string): Promise<boolean> => {
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
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Failed to unpublish deck');
      }
      return true;
    } catch (err) {
      setError({
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
