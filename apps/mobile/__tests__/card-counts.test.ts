import { countCardsPerDeck } from '@/lib/card-counts';

const m = (deck_id: string, note_id: string) => ({ deck_id, note_id });
const c = (note_id: string) => ({ note_id });

describe('countCardsPerDeck', () => {
  it('counts every card of every note in the deck', () => {
    const counts = countCardsPerDeck(
      [m('d1', 'n1'), m('d1', 'n2')],
      [c('n1'), c('n2'), c('n3')],
    );
    expect(counts.get('d1')).toBe(2);
  });

  it('counts several cards for one note', () => {
    const counts = countCardsPerDeck([m('d1', 'n1')], [c('n1'), c('n1')]);
    expect(counts.get('d1')).toBe(2);
  });

  it('counts a shared note in each deck that holds it', () => {
    const counts = countCardsPerDeck([m('d1', 'n1'), m('d2', 'n1')], [c('n1')]);
    expect(counts.get('d1')).toBe(1);
    expect(counts.get('d2')).toBe(1);
  });

  it('gives zero for a note without cards and no entry for a deck without notes', () => {
    const counts = countCardsPerDeck([m('d1', 'n1')], []);
    expect(counts.get('d1')).toBe(0);
    expect(counts.get('d2')).toBeUndefined();
  });
});
