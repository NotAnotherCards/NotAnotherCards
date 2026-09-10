import { useState, useEffect, useCallback } from 'react';

export interface SharedDeckSummary {
  id: string;
  title: string | null;
  description: string | null;
  noteType: string;
  nativeLanguageId: string | null;
  targetLanguageId: string | null;
  updatedAt: number;
  cardCount: number;
  owner: { username: string };
}

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
      const data = await response.json();
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
