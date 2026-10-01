import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

export function useImportDeck() {
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const importDeck = async (
    deckId: string,
  ): Promise<{ deckId: string } | null> => {
    setImportingIds((prev) => {
      const next = new Set(prev);
      next.add(deckId);
      return next;
    });
    setError(null);
    try {
      return await apiClient.sharedDecks.import(deckId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return null;
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(deckId);
        return next;
      });
    }
  };

  return { importDeck, importingIds, error };
}
