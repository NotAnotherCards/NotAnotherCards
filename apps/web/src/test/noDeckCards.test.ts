import { describe, expect, it } from 'vitest';
import { cardsWithoutActiveDeck } from '@/lib/no-deck-cards';

const card = (id: string, noteId: string) =>
  ({ id, note_id: noteId });

const membership = (noteId: string, active: boolean) =>
  ({ note_id: noteId, active });

describe('cardsWithoutActiveDeck', () => {
  it('keeps cards whose notes have no membership or only inactive memberships', () => {
    const result = cardsWithoutActiveDeck(
      [card('orphan', 'orphan-note'), card('removed', 'removed-note')],
      [membership('removed-note', false)],
    );

    expect(result.map((item) => item.id)).toEqual(['orphan', 'removed']);
  });

  it('excludes notes that belong to one or more active decks', () => {
    const result = cardsWithoutActiveDeck(
      [
        card('one-deck', 'one-deck-note'),
        card('two-decks', 'two-decks-note'),
        card('orphan', 'orphan-note'),
      ],
      [
        membership('one-deck-note', true),
        membership('two-decks-note', true),
        membership('two-decks-note', true),
      ],
    );

    expect(result.map((item) => item.id)).toEqual(['orphan']);
  });
});
