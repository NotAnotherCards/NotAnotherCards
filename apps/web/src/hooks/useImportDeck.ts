import { useState } from 'react';

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
      const res = await fetch(
        `/api/shared/decks/${encodeURIComponent(deckId)}/import`,
        {
          method: 'POST',
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Failed to import deck');
      }
      const data = await res.json();
      return data;
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
