import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  type UserCardRecord,
  type UserNoteRecord,
} from '@repo/offline-db';
import {
  cardsForDeck,
  decksWithDueCards,
  isBasicCard,
} from '@/lib/cards-in-deck';

const m = (deck_id: string, note_id: string) => ({ deck_id, note_id });
const c = (id: string, note_id: string) => ({ id, note_id });

describe('cardsForDeck', () => {
  it('returns the cards of the notes in the deck, in card order', () => {
    const cards = [c('c3', 'n3'), c('c1', 'n1'), c('c2', 'n1')];
    const out = cardsForDeck([m('d1', 'n1'), m('d2', 'n3')], cards, 'd1');
    expect(out.map((x) => x.id)).toEqual(['c1', 'c2']);
  });

  it('gives an empty list for a deck without notes', () => {
    expect(cardsForDeck([m('d1', 'n1')], [c('c1', 'n1')], 'd2')).toEqual([]);
  });
});

describe('decksWithDueCards', () => {
  const now = 1_000_000;
  const due = (note_id: string) =>
    ({ note_id, due_at: now - 1 }) as UserCardRecord;
  const later = (note_id: string) =>
    ({ note_id, due_at: now + 60_000 }) as UserCardRecord;

  it('lists every deck that holds a due note, a shared note counts for both', () => {
    const decks = decksWithDueCards(
      [m('d1', 'n1'), m('d2', 'n1'), m('d3', 'n2')],
      [due('n1'), later('n2')],
      now,
    );
    expect([...decks].sort()).toEqual(['d1', 'd2']);
  });

  it('leaves out a deck whose cards are all scheduled ahead', () => {
    expect(decksWithDueCards([m('d1', 'n1')], [later('n1')], now).size).toBe(0);
  });

  it('leaves out a deck whose memberships are gone, as after deleteDeck', () => {
    // deleteDeck marks the deck's membership rows deleted; the active query
    // no longer returns them, so the deck has no route to the set.
    expect(decksWithDueCards([], [due('n1')], now).size).toBe(0);
  });
});

describe('isBasicCard', () => {
  const basicNote = {
    id: 'n1',
    note_type: BASIC_NOTE_TYPE,
    fields_version: BASIC_NOTE_FIELDS_VERSION,
  } as UserNoteRecord;
  const card = (over: Partial<UserCardRecord>) =>
    ({
      note_id: 'n1',
      template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
      ...over,
    }) as UserCardRecord;
  const notes = new Map([['n1', basicNote]]);

  it('accepts a basic note with the front-back template', () => {
    expect(isBasicCard(card({}), notes)).toBe(true);
  });

  it('rejects another template, another note type, another version, or a missing note', () => {
    expect(isBasicCard(card({ template_key: 'audio' }), notes)).toBe(false);
    expect(
      isBasicCard(
        card({}),
        new Map([['n1', { ...basicNote, note_type: 'word' }]]),
      ),
    ).toBe(false);
    expect(
      isBasicCard(
        card({}),
        new Map([['n1', { ...basicNote, fields_version: 2 }]]),
      ),
    ).toBe(false);
    expect(isBasicCard(card({ note_id: 'missing' }), notes)).toBe(false);
  });
});
