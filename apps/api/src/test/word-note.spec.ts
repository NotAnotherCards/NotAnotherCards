import { ENGLISH, GERMAN, type WordNotePayload } from '@repo/schemas';
import { assembleWordNoteCandidate } from '../ai/word-note';
import { WORD_NOTE_V1 } from '../ai/prompts/word-note.v1';

const payload = (direction: 'target' | 'native'): WordNotePayload => ({
  deckId: 'deck-1',
  word: direction === 'target' ? 'Hund' : 'dog',
  direction,
  nativeLanguageId: ENGLISH,
  nativeLanguageName: 'English',
  targetLanguageId: GERMAN,
  targetLanguageName: 'German',
});

const generated = {
  word: 'Hund',
  translation: 'dog',
  part_of_speech: 'noun',
  example: 'Der Hund schläft.',
  example_translation: 'The dog sleeps.',
  pronunciation: 'hʊnt',
};

describe('word note generation', () => {
  it.each(['target', 'native'] as const)(
    'keeps the %s-language input authoritative',
    (direction) => {
      const input = payload(direction);
      const candidate = assembleWordNoteCandidate(input, {
        ...generated,
        word: 'model word',
        translation: 'model translation',
        image: 'hallucinated-file',
        word_audio: 'hallucinated-audio',
        notes: 'hallucinated-note',
      });

      expect(candidate).toMatchObject({
        noteType: 'word',
        fieldsVersion: 1,
        fields: {
          word: direction === 'target' ? input.word : 'model word',
          translation:
            direction === 'native' ? input.word : 'model translation',
          native_language_id: ENGLISH,
          target_language_id: GERMAN,
        },
      });
      expect(candidate.fields).not.toHaveProperty('image');
      expect(candidate.fields).not.toHaveProperty('word_audio');
      expect(candidate.fields).not.toHaveProperty('notes');
    },
  );

  it('requires generated metadata and enforces field lengths', () => {
    expect(() =>
      assembleWordNoteCandidate(payload('target'), {
        word: 'Hund',
        translation: 'dog',
      }),
    ).toThrow();
    expect(() =>
      assembleWordNoteCandidate(payload('target'), {
        ...generated,
        example: 'x'.repeat(1001),
      }),
    ).toThrow();
  });

  it('drops a gender the target language does not have', () => {
    const candidate = assembleWordNoteCandidate(payload('target'), {
      ...generated,
      gender: 'la',
    });
    expect(candidate.fields.gender).toBeUndefined();
  });

  it('normalises a usable gender and tolerates null', () => {
    const upper = assembleWordNoteCandidate(payload('target'), {
      ...generated,
      gender: ' Der ',
    });
    expect(upper.fields.gender).toBe('der');

    // English has no genders; a model that still emits one must not fail the job
    const english: WordNotePayload = {
      ...payload('native'),
      nativeLanguageId: GERMAN,
      nativeLanguageName: 'German',
      targetLanguageId: ENGLISH,
      targetLanguageName: 'English',
    };
    for (const gender of [null, '', 'n/a', 'der']) {
      const candidate = assembleWordNoteCandidate(english, {
        ...generated,
        gender,
      });
      expect(candidate.fields.gender).toBeUndefined();
    }
  });

  it('accepts identical words and translations', () => {
    expect(
      assembleWordNoteCandidate(payload('target'), {
        ...generated,
        translation: 'Hund',
      }).fields.translation,
    ).toBe('Hund');
  });

  it('builds direction-specific prompts with plain language names and gender values', () => {
    const targetPrompt = WORD_NOTE_V1.buildUserPrompt(payload('target'));
    const nativePrompt = WORD_NOTE_V1.buildUserPrompt(payload('native'));

    // each direction names which JSON key holds which language
    expect(targetPrompt).toContain('"word" is the German word "Hund", given');
    expect(targetPrompt).toContain('English translation in "translation"');
    expect(nativePrompt).toContain(
      '"translation" is the English word "dog", given',
    );
    expect(nativePrompt).toContain('German translation in "word"');
    expect(nativePrompt).toContain(
      '"example" is a German sentence using "word"',
    );
    expect(targetPrompt).toContain('Native language: English');
    expect(targetPrompt).toContain('Target language: German');
    expect(targetPrompt).toContain('der, die, das');
    expect(targetPrompt).not.toContain('🇩🇪');
  });
});
