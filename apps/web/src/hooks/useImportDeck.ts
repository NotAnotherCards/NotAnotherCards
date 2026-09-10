import { useState } from 'react';
import { apiErrorBodySchema } from '@repo/schemas';
import { z } from 'zod';

const importSuccessSchema = z.object({ deckId: z.string() });

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
        const json: unknown = await res.json().catch(() => null);
        const errorBody = apiErrorBodySchema.parse(json);
        throw new Error(errorBody.message || 'Failed to import deck');
      }
      const json: unknown = await res.json();
      return importSuccessSchema.parse(json);
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
