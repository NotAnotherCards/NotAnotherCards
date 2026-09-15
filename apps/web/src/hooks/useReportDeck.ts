import { useState } from 'react';
import { apiErrorBodySchema, deckReportResponseSchema } from '@repo/schemas';

export function useReportDeck() {
  const [reportingIds, setReportingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const reportDeck = async (deckId: string, reason: string) => {
    setReportingIds((current) => new Set(current).add(deckId));
    setError(null);
    try {
      const response = await fetch(
        `/api/shared/decks/${encodeURIComponent(deckId)}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
      );
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const body = apiErrorBodySchema.safeParse(json);
        throw new Error(body.success ? body.data.message : 'Report failed');
      }
      return deckReportResponseSchema.parse(json);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report failed');
      return null;
    } finally {
      setReportingIds((current) => {
        const next = new Set(current);
        next.delete(deckId);
        return next;
      });
    }
  };

  return { reportDeck, reportingIds, error, setError };
}
