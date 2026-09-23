import { useState, useEffect, useCallback, useRef } from 'react';
import {
  gamificationLeaderboardSchema,
  type GamificationLeaderboard,
} from '@repo/schemas';

export function useLeaderboard(limit: number, offset: number) {
  const [data, setData] = useState<GamificationLeaderboard | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevOffsetRef = useRef<number>(offset);

  const fetchLeaderboard = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);
    if (prevOffsetRef.current !== offset) {
      setData(null); // Clear previous data only if the page number changed
      setLastUpdated(null);
      prevOffsetRef.current = offset;
    }

    try {
      // Request limit + 1 to check if there is a next page
      const response = await fetch(
        `/api/gamification/leaderboard?limit=${limit + 1}&offset=${offset}`,
        { signal: abortController.signal },
      );
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      const json: unknown = await response.json();
      const parsedData = gamificationLeaderboardSchema.parse(json);

      let more = false;
      if (parsedData.entries.length > limit) {
        more = true;
        parsedData.entries = parsedData.entries.slice(0, limit);
      }
      setHasMore(more);
      setData(parsedData);
      setLastUpdated(Date.now());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore abort errors
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (abortControllerRef.current === abortController) {
        setIsLoading(false);
      }
    }
  }, [limit, offset]);

  useEffect(() => {
    void fetchLeaderboard();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchLeaderboard]);

  return {
    data,
    hasMore,
    isLoading,
    error,
    lastUpdated,
    refetch: fetchLeaderboard,
  };
}
