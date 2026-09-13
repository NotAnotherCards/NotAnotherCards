import { useState, useEffect, useCallback } from 'react';
import { sharedDeckListSchema, type SharedDeckSummary } from '@repo/schemas';

export function useSharedDecks() {
  const [decks, setDecks] = useState<SharedDeckSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/shared/decks');
      if (!response.ok) {
        throw new Error('Failed to fetch shared decks');
      }
      const json: unknown = await response.json();
      const data = sharedDeckListSchema.parse(json);
      setDecks(data.decks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDecks();
  }, [fetchDecks]);

  return { decks, isLoading, error, refetch: fetchDecks };
}
