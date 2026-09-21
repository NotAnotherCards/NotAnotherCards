import { useState, useEffect, useCallback } from 'react';
import {
  gamificationLeaderboardSchema,
  type GamificationLeaderboard,
} from '@repo/schemas';

export function useLeaderboard(limit: number, offset: number) {
  const [data, setData] = useState<GamificationLeaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/gamification/leaderboard?limit=${limit}&offset=${offset}`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      const json: unknown = await response.json();
      const parsedData = gamificationLeaderboardSchema.parse(json);
      setData(parsedData);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { data, isLoading, error, lastUpdated, refetch: fetchLeaderboard };
}
