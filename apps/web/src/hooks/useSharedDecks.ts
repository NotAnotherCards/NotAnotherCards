import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { type SharedDeckSummary } from '@repo/schemas';
import { apiClient } from '@/lib/api-client';

export function useSharedDecks() {
  const { t } = useTranslation();
  const [decks, setDecks] = useState<SharedDeckSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.sharedDecks.list();
      setDecks(data.decks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknown_error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchDecks();
  }, [fetchDecks]);

  return { decks, isLoading, error, refetch: fetchDecks };
}
