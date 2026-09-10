import { useState } from 'react';

export function useImportDeck() {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importDeck = async (
    deckId: string,
  ): Promise<{ deckId: string } | null> => {
    setIsImporting(true);
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
      setIsImporting(false);
    }
  };

  return { importDeck, isImporting, error };
}
