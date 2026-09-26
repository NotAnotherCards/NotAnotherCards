import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

export function useReportDeck() {
  const [reportingIds, setReportingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const reportDeck = async (deckId: string, reason: string) => {
    setReportingIds((current) => new Set(current).add(deckId));
    setError(null);
    try {
      return await apiClient.sharedDecks.report(deckId, reason);
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
