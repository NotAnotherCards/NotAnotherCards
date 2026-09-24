import { describe, expect, it } from 'vitest';
import type { Card } from '@/hooks/useStore';
import {
  WORD_TO_TRANSLATION_TEMPLATE_KEY,
  type UserNoteRecord,
} from '@repo/offline-db';
import { GERMAN, RUSSIAN } from '@repo/schemas';
import { countWordDetails, toWordRow } from './word-note-rows';

const note: UserNoteRecord = {
  id: 'note-1',
  note_type: 'word',
  fields_version: 1,
  fields_json: JSON.stringify({
    word: 'Hund',
    translation: 'dog',
    native_language_id: RUSSIAN,
    target_language_id: GERMAN,
    example: 'Der Hund läuft.',
    example_translation: 'The dog runs.',
    gender: 'der',
  }),
  additional_content: null,
  created_at: 0,
  updated_at: 0,
};

const cards: Card[] = [
  {
    id: 'card-1',
    note_id: note.id,
    template_key: WORD_TO_TRANSLATION_TEMPLATE_KEY,
    active: true,
    front: 'Hund',
    back: 'dog',
    due_at: 0,
    scheduled_interval_minutes: 0,
    created_at: 0,
    updated_at: 0,
  },
];

describe('word note rows', () => {
  it('creates one display row with the correct word-card badge', () => {
    const row = toWordRow(note, cards);

    expect(row).toMatchObject({
      word: 'Hund',
      translation: 'dog',
      detailsCount: 2,
      badges: ['DE → RU'],
    });
  });

  it('labels example cards with the native-language translation', () => {
    const row = toWordRow(note, [
      ...cards,
      {
        ...cards[0],
        id: 'example-card-1',
        template_key: 'example-to-translation',
      },
    ]);

    expect(row?.badges).toContain('Example → RU');
  });

  it('counts an example and its translation as one extra detail', () => {
    expect(
      countWordDetails({
        example: 'Der Hund läuft.',
        example_translation: 'The dog runs.',
        image: 'https://example.com/hund.png',
      }),
    ).toBe(2);
  });
});
