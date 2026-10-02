import { describe, expect, it } from 'vitest';
import { GERMAN, RUSSIAN } from '@repo/schemas';
import { deckTypeAccessibilityLabel } from './deck-type-label';

const translate = (
  key: 'basic' | 'word' | 'unknown',
  options?: { noteType: string },
) => {
  if (key === 'basic') return 'Card deck';
  if (key === 'word') return 'Word deck';
  return `Unknown deck type: ${options?.noteType}`;
};

describe('deckTypeAccessibilityLabel', () => {
  const wordDeck = {
    note_type: 'word',
    native_language_id: GERMAN,
    target_language_id: RUSSIAN,
  };

  it('uses the current German interface language', () => {
    expect(deckTypeAccessibilityLabel(wordDeck, 'de', translate)).toBe(
      '🇩🇪 Deutsch → 🇷🇺 Russisch',
    );
  });

  it('uses the current Russian interface language', () => {
    expect(deckTypeAccessibilityLabel(wordDeck, 'ru', translate)).toBe(
      '🇩🇪 Немецкий → 🇷🇺 Русский',
    );
  });

  it('uses translated fallbacks for basic, incomplete, and unknown decks', () => {
    expect(
      deckTypeAccessibilityLabel({ note_type: 'basic' }, 'en', translate),
    ).toBe('Card deck');
    expect(
      deckTypeAccessibilityLabel({ note_type: 'word' }, 'en', translate),
    ).toBe('Word deck');
    expect(
      deckTypeAccessibilityLabel({ note_type: 'cloze' }, 'en', translate),
    ).toBe('Unknown deck type: cloze');
  });
});
