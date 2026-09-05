import { describe, expect, it } from 'vitest';
import { cardId, noteDeckId } from './ids.js';

// The literals below were computed once and must never change: these ids
// are derived on every device, and rows created under one derivation are
// unreachable under another. A failure here means the uuidv5 namespace or
// the tuple encoding moved, which is a sync protocol break, not a refactor.
describe('deterministic ids', () => {
  it('derives the frozen card id', () => {
    expect(cardId('note-1', 'front-back')).toBe(
      '66e44b0b-0891-5220-9855-893aa9f04d29',
    );
  });

  it('derives the frozen membership id', () => {
    expect(noteDeckId('note-1', 'deck-1')).toBe(
      'e54c4b9d-0c4d-54e4-8016-9e7ca4bcd58d',
    );
  });

  it('keeps the tuple order significant', () => {
    expect(cardId('a', 'b')).not.toBe(cardId('b', 'a'));
  });
});
