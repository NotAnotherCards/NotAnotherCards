import { describe, expect, it } from 'vitest';
import { countCardsPerDeck, reviewTarget } from './cards-by-deck.js';

const membership = (deck_id: string, note_id: string) => ({
  deck_id,
  note_id,
});
const card = (note_id: string) => ({ note_id });

describe('reviewTarget', () => {
  const now = 1000;
  const cards = [
    { id: 'c1', note_id: 'n1', due_at: now },
    { id: 'c2', note_id: 'n2', due_at: now - 1 },
    { id: 'c3', note_id: 'n3', due_at: now + 1 },
  ];

  it.each([
    {
      name: 'prefers the remembered deck when several decks are due',
      lastDeckId: 'd2',
      memberships: [membership('d1', 'n1'), membership('d2', 'n2')],
      expected: 'd2',
    },
    {
      name: 'chooses the only due deck when the remembered deck is not due',
      lastDeckId: 'd1',
      memberships: [membership('d1', 'n3'), membership('d2', 'n2')],
      expected: 'd2',
    },
    {
      name: 'opens the library when several other decks are due',
      lastDeckId: 'd3',
      memberships: [
        membership('d1', 'n1'),
        membership('d2', 'n2'),
        membership('d3', 'n3'),
      ],
      expected: 'library',
    },
    {
      name: 'returns nothing-due when all deck cards are in the future',
      lastDeckId: 'd1',
      memberships: [membership('d1', 'n3')],
      expected: 'nothing-due',
    },
    {
      name: 'skips a deleted remembered deck with no memberships',
      lastDeckId: 'deleted',
      memberships: [membership('d2', 'n2')],
      expected: 'd2',
    },
    {
      name: 'counts a shared due note in both decks',
      lastDeckId: null,
      memberships: [membership('d1', 'n1'), membership('d2', 'n1')],
      expected: 'library',
    },
    {
      name: 'chooses the only due deck without a remembered deck',
      lastDeckId: null,
      memberships: [membership('d1', 'n1')],
      expected: 'd1',
    },
    {
      name: 'ignores due cards outside any deck',
      lastDeckId: null,
      memberships: [],
      expected: 'nothing-due',
    },
  ])('$name', ({ lastDeckId, memberships, expected }) => {
    expect(reviewTarget({ lastDeckId, memberships, cards, now })).toBe(
      expected,
    );
  });

  it('returns nothing-due with no cards, including decks without cards', () => {
    expect(
      reviewTarget({
        lastDeckId: null,
        memberships: [membership('d1', 'n1')],
        cards: [],
        now,
      }),
    ).toBe('nothing-due');
  });
});

describe('countCardsPerDeck', () => {
  it('counts every card of every note in the deck', () => {
    const counts = countCardsPerDeck(
      [membership('d1', 'n1'), membership('d1', 'n2')],
      [card('n1'), card('n2'), card('n3')],
    );
    expect(counts.get('d1')).toBe(2);
  });

  it('counts several cards for one note', () => {
    const counts = countCardsPerDeck(
      [membership('d1', 'n1')],
      [card('n1'), card('n1')],
    );
    expect(counts.get('d1')).toBe(2);
  });

  it('counts a shared note in each deck that holds it', () => {
    const counts = countCardsPerDeck(
      [membership('d1', 'n1'), membership('d2', 'n1')],
      [card('n1')],
    );
    expect(counts.get('d1')).toBe(1);
    expect(counts.get('d2')).toBe(1);
  });

  it('gives zero for a note without cards and handles empty input', () => {
    const counts = countCardsPerDeck([membership('d1', 'n1')], []);
    expect(counts.get('d1')).toBe(0);
    expect(counts.get('d2')).toBeUndefined();
    expect(countCardsPerDeck([], [])).toEqual(new Map());
  });
});
