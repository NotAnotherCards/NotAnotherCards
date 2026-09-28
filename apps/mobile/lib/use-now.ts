import { useEffect, useState } from 'react';

// The current time, refreshed every interval. Screens that count by the
// clock (cards coming due, the UTC day behind streaks and daily goals)
// otherwise only move on a data change: an Overview left open past
// midnight kept yesterday's goals. Web's Overview ticks every minute too.
export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
