import { describe, expect, it } from 'vitest';
import { countCards, countDueCards, countWords } from './deck-counts.js';

describe('deck counts', () => {
  it('counts word notes and cards without depending on a UI', () => {
    expect(countWords([{ id: 'word-1' }, { id: 'word-2' }])).toBe(2);
    expect(countCards([{ id: 'card-1' }, { id: 'card-2' }])).toBe(2);
  });

  it('counts only cards whose id is in the due collection', () => {
    expect(
      countDueCards(
        [{ id: 'card-1' }, { id: 'card-2' }, { id: 'card-3' }],
        [{ id: 'card-2' }, { id: 'missing-card' }],
      ),
    ).toBe(1);
  });
});
