import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  type UserCardRecord,
  type UserNoteRecord,
} from '@repo/offline-db';
import { isBasicCard } from '@/lib/cards-in-deck';

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
