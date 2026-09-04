import { describe, expect, it } from 'vitest';
import {
  BasicNoteFieldsV1,
  noteTypeRegistry,
  validateNoteFieldsJson,
  WordNoteFieldsV1,
  type WordNoteFields,
} from './note-registry.js';

const word: WordNoteFields = {
  word: 'laufen',
  translation: 'to run',
  native_language_id: 'lang-en',
  target_language_id: 'lang-de',
};

const fullWord: WordNoteFields = {
  ...word,
  example: 'Ich laufe jeden Morgen.',
  example_translation: 'I run every morning.',
  part_of_speech: 'verb',
  gender: undefined,
  pronunciation: 'ˈlaʊfn̩',
  notes: undefined,
};

describe('WordNoteFieldsV1', () => {
  it('accepts the minimal note: word, translation, both languages', () => {
    expect(WordNoteFieldsV1.safeParse(word).success).toBe(true);
  });

  it.each(['word', 'translation', 'native_language_id', 'target_language_id'])(
    'rejects a note missing %s',
    (key) => {
      const { [key as keyof WordNoteFields]: _gone, ...partial } = word;
      expect(WordNoteFieldsV1.safeParse(partial).success).toBe(false);
    },
  );

  it('rejects a whitespace-only word and canonicalizes padding', () => {
    expect(WordNoteFieldsV1.safeParse({ ...word, word: '   ' }).success).toBe(
      false,
    );
    const parsed = WordNoteFieldsV1.parse({ ...word, word: '  laufen  ' });
    expect(parsed.word).toBe('laufen');
  });

  it('rejects unknown fields, so word@2 additions cannot masquerade as @1', () => {
    expect(
      WordNoteFieldsV1.safeParse({ ...word, plural_form: 'Läufe' }).success,
    ).toBe(false);
  });

  it('rejects a present-but-empty optional field', () => {
    expect(WordNoteFieldsV1.safeParse({ ...word, example: '' }).success).toBe(
      false,
    );
  });
});

describe('word templates', () => {
  const templates = noteTypeRegistry['word']![1]!.templates;
  const byKey = Object.fromEntries(templates.map((t) => [t.key, t]));

  it('declares templates in the #157 sibling order', () => {
    expect(templates.map((t) => t.key)).toEqual([
      'word-to-translation',
      'translation-to-word',
      'example-to-translation',
    ]);
  });

  it('always yields both direction cards, the example card only when complete', () => {
    expect(byKey['word-to-translation']!.requires(word)).toBe(true);
    expect(byKey['translation-to-word']!.requires(word)).toBe(true);
    expect(byKey['example-to-translation']!.requires(word)).toBe(false);
    expect(
      byKey['example-to-translation']!.requires({
        ...word,
        example: 'Ich laufe.',
      }),
    ).toBe(false);
    expect(byKey['example-to-translation']!.requires(fullWord)).toBe(true);
  });

  it('renders word-to-translation with the part of speech and example', () => {
    expect(byKey['word-to-translation']!.render(fullWord)).toEqual({
      front: 'laufen *(verb)*',
      back: 'to run\n\nIch laufe jeden Morgen.',
    });
    expect(byKey['word-to-translation']!.render(word)).toEqual({
      front: 'laufen',
      back: 'to run',
    });
  });

  it('renders the reverse and example cards', () => {
    expect(byKey['translation-to-word']!.render(word)).toEqual({
      front: 'to run',
      back: 'laufen',
    });
    expect(byKey['example-to-translation']!.render(fullWord)).toEqual({
      front: 'Ich laufe jeden Morgen.',
      back: 'I run every morning.',
    });
  });

  it('never restates a front at the start of its back (the review screen composes them)', () => {
    for (const template of templates) {
      if (!template.requires(fullWord)) continue;
      const { front, back } = template.render(fullWord);
      expect(back).not.toBe(front);
      expect(back.startsWith(front)).toBe(false);
    }
  });
});

describe('the registry feeds validateNoteFieldsJson', () => {
  it('accepts a valid word@1 payload', () => {
    const result = validateNoteFieldsJson('word', 1, JSON.stringify(word));
    expect(result.success).toBe(true);
  });

  it('rejects a partial word@1 payload, so it cannot enter the sync protocol', () => {
    const { word: _gone, ...partial } = word;
    expect(
      validateNoteFieldsJson('word', 1, JSON.stringify(partial)).success,
    ).toBe(false);
  });

  it('keeps basic@1 exactly as before', () => {
    expect(BasicNoteFieldsV1.safeParse({ front: '', back: '' }).success).toBe(
      true,
    );
    expect(
      validateNoteFieldsJson('basic', 1, '{"front":"a","back":"b"}').success,
    ).toBe(true);
    expect(validateNoteFieldsJson('word', 2, '{}').success).toBe(false);
  });
});

describe('every word@1 field, one by one', () => {
  const realisticValues = {
    example: 'Der Hund schläft im Garten.',
    example_translation: 'The dog sleeps in the garden.',
    part_of_speech: 'noun',
    gender: 'der',
    pronunciation: 'hʊnt',
    image: 'a3f8c2d1-media-id',
    word_audio: 'b7e9d4f2-media-id',
    notes: 'false friend of *hound*, which is narrower',
  } as const;
  const optionalFields = Object.keys(
    realisticValues,
  ) as readonly (keyof typeof realisticValues)[];

  it.each(optionalFields)('accepts %s when present and non-empty', (key) => {
    const parsed = WordNoteFieldsV1.safeParse({
      ...word,
      [key]: realisticValues[key],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data[key]).toBe(realisticValues[key]);
  });

  it('parses a fully specified noun, gender included', () => {
    const hund = WordNoteFieldsV1.parse({
      word: 'Hund',
      translation: 'dog',
      native_language_id: 'lang-en',
      target_language_id: 'lang-de',
      ...realisticValues,
    });
    expect(hund.gender).toBe('der');
    const templates = noteTypeRegistry['word']![1]!.templates;
    expect(templates[0]!.render(hund)).toEqual({
      front: 'Hund *(noun)*',
      back: 'dog\n\nDer Hund schläft im Garten.',
    });
  });

  it.each(optionalFields)('rejects an empty %s', (key) => {
    expect(WordNoteFieldsV1.safeParse({ ...word, [key]: '' }).success).toBe(
      false,
    );
  });

  it.each(optionalFields)('rejects a non-string %s', (key) => {
    expect(WordNoteFieldsV1.safeParse({ ...word, [key]: 7 }).success).toBe(
      false,
    );
  });

  it.each(['gender', 'pronunciation', 'notes', 'image', 'word_audio'] as const)(
    'keeps %s out of every render until its feature exists',
    (key) => {
      const withField = WordNoteFieldsV1.parse({
        ...fullWord,
        [key]: 'sentinel-value',
      });
      const without = WordNoteFieldsV1.parse(fullWord);
      for (const template of noteTypeRegistry['word']![1]!.templates) {
        if (!template.requires(withField)) continue;
        expect(template.render(withField)).toEqual(template.render(without));
      }
    },
  );

  it('trims every text field to its canonical form', () => {
    const parsed = WordNoteFieldsV1.parse({
      ...word,
      translation: '  to run  ',
      example: '  Ich laufe.  ',
      example_translation: '  I run.  ',
      gender: '  neuter  ',
    });
    expect(parsed.translation).toBe('to run');
    expect(parsed.example).toBe('Ich laufe.');
    expect(parsed.example_translation).toBe('I run.');
    expect(parsed.gender).toBe('neuter');
  });
});
