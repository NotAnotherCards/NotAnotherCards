import { compileNote } from '@repo/offline-db';
import { ENGLISH, SPANISH } from '@repo/schemas';
import {
  moderationNotes,
  moderationTexts,
  isShortText,
} from '../sharing/moderation-context';

const fields = {
  word: 'gordo',
  translation: 'fat',
  example: 'El gato está gordo.',
  example_translation: 'The cat is fat.',
  native_language_id: ENGLISH,
  target_language_id: SPANISH,
};
const compiled = compileNote('word', 1, fields);
const snapshot = () => ({
  nativeLanguageId: ENGLISH,
  targetLanguageId: SPANISH,
  content: {
    notes: [
      {
        id: 'note',
        note_type: 'word',
        fields_version: 1,
        fields_json: compiled.fieldsJson,
        additional_content: 'Extra text',
      },
    ],
    cards: compiled.cards.map((card, i) => ({
      id: `card-${i}`,
      note_id: 'note',
      template_key: card.templateKey,
      front: card.front,
      back: card.back,
    })),
  },
});

it('screens individual fields and additional content with no field labels or framing', () => {
  const notes = moderationNotes(snapshot());
  expect(notes[0].languages).toEqual({ native: 'English', target: 'Spanish' });
  const texts = moderationTexts(notes);
  expect(texts.map((row) => row.text)).toEqual([
    'gordo',
    'fat',
    fields.example,
    fields.example_translation,
    'Extra text',
  ]);
  for (const text of texts)
    expect(text.cardIds).toEqual(['card-0', 'card-1', 'card-2']);
});

it.each([
  ['broken JSON', 'word', '{'],
  ['new type', 'cloze', '{}'],
  ['bad fields', 'word', '{"word":42}'],
])('uses rendered-text fallback for %s', (_name, type, json) => {
  const changed = snapshot();
  changed.content.notes[0].note_type = type;
  changed.content.notes[0].fields_json = json;
  expect(
    moderationTexts(moderationNotes(changed)).map((row) => row.text),
  ).toEqual([
    ...new Set([
      ...changed.content.cards.flatMap((card) => [card.front, card.back]),
      'Extra text',
    ]),
  ]);
});

it('screens orphan cards and differing legacy faces', () => {
  const changed = snapshot();
  changed.content.cards[0].back = 'Legacy text';
  changed.content.cards.push({
    id: 'orphan',
    note_id: 'missing',
    template_key: 'unknown',
    front: 'Orphan front',
    back: 'Orphan back',
  });
  const texts = moderationTexts(moderationNotes(changed));
  expect(texts.find((row) => row.text === 'Legacy text')?.cardIds).toEqual([
    'card-0',
    'card-1',
    'card-2',
  ]);
  expect(texts.find((row) => row.text === 'Orphan back')?.cardIds).toEqual([
    'orphan',
  ]);
});

it('preserves corpus bytes and excludes long fields from every judge context', () => {
  const changed = snapshot();
  changed.content.notes[0].fields_json = JSON.stringify({
    ...fields,
    example: '  ' + 'x'.repeat(41) + '  ',
  });
  const texts = moderationTexts(moderationNotes(changed));
  expect(texts.map((row) => row.text)).toContain('  ' + 'x'.repeat(41) + '  ');
  for (const row of texts)
    expect(row.contexts.join('')).not.toContain('x'.repeat(41));
  expect(isShortText('é'.repeat(40))).toBe(true);
  expect(isShortText('é'.repeat(41))).toBe(false);
});

it('deduplicates exact texts across a deck, mapping to every containing card', () => {
  const notes = moderationNotes(snapshot());
  notes.push({ ...notes[0], id: 'other', cardIds: ['other-card'] });
  const texts = moderationTexts(notes);
  expect(texts.filter((row) => row.text === 'fat')).toHaveLength(1);
  expect(texts.find((row) => row.text === 'fat')?.cardIds).toEqual([
    'card-0',
    'card-1',
    'card-2',
    'other-card',
  ]);
});
