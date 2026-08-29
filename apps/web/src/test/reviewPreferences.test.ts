import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearLastReviewDeckId,
  getLastReviewDeckId,
  saveLastReviewDeckId,
} from '@/lib/review-preferences';

describe('review preferences', () => {
  const entries = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => entries.clear(),
        getItem: (key: string) => entries.get(key) ?? null,
        key: (index: number) => [...entries.keys()][index] ?? null,
        get length() {
          return entries.size;
        },
        removeItem: (key: string) => entries.delete(key),
        setItem: (key: string, value: string) => entries.set(key, value),
      } satisfies Storage,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps the last review deck separate for each user', () => {
    saveLastReviewDeckId('user-1', 'deck-german');
    saveLastReviewDeckId('user-2', 'deck-spanish');

    expect(getLastReviewDeckId('user-1')).toBe('deck-german');
    expect(getLastReviewDeckId('user-2')).toBe('deck-spanish');
  });

  it('removes an unavailable saved deck preference', () => {
    saveLastReviewDeckId('user-1', 'deleted-deck');
    clearLastReviewDeckId('user-1');

    expect(getLastReviewDeckId('user-1')).toBeNull();
  });
});
