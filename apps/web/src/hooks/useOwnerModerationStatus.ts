import { useCallback, useEffect, useState } from 'react';
import {
  ownerModerationStatusSchema,
  type OwnerModerationStatus,
} from '@repo/schemas';

export function useOwnerModerationStatus(deckId: string) {
  const [status, setStatus] = useState<OwnerModerationStatus>({
    status: 'clear',
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/decks/${encodeURIComponent(deckId)}/moderation`,
      );
      if (!response.ok) return;
      const json: unknown = await response.json().catch(() => null);
      const parsed = ownerModerationStatusSchema.safeParse(json);
      if (parsed.success) setStatus(parsed.data);
    } catch {
      // Moderation status is supplemental to the offline deck. Being offline
      // must not turn the otherwise local deck detail into an error state.
    }
  }, [deckId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, refresh };
}
