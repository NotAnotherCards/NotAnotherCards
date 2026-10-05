import { useCallback, useEffect, useState } from 'react';
import { type OwnerModerationStatus } from '@repo/schemas';
import { apiClient } from '@/lib/api-client';

export function useOwnerModerationStatus(deckId: string) {
  const [status, setStatus] = useState<OwnerModerationStatus>({
    status: 'clear',
  });

  const refresh = useCallback(async () => {
    try {
      setStatus(await apiClient.publishing.moderationStatus(deckId));
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
