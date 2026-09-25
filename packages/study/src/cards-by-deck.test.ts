import { describe, expect, it } from 'vitest';
import { cardsForDeck, countCardsPerDeck } from './cards-by-deck.js';

const membership = (deck_id: string, note_id: string) => ({
  deck_id,
  note_id,
});
const card = (note_id: string) => ({ note_id });

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

describe('cardsForDeck', () => {
  const m = (deck_id: string, note_id: string) => ({ deck_id, note_id });
  const c = (id: string, note_id: string) => ({ id, note_id });

  it('returns the cards of the notes in the deck, in card order', () => {
    const cards = [c('c3', 'n3'), c('c1', 'n1'), c('c2', 'n1')];
    const out = cardsForDeck([m('d1', 'n1'), m('d2', 'n3')], cards, 'd1');
    expect(out.map((x) => x.id)).toEqual(['c1', 'c2']);
  });

  it('gives an empty list for a deck without notes', () => {
    expect(cardsForDeck([m('d1', 'n1')], [c('c1', 'n1')], 'd2')).toEqual([]);
  });
});
