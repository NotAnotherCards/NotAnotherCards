import { describe, it, expect } from 'vitest';
import {
  AI_MODELS,
  aiCardOutputSchema,
  aiJobSchema,
  aiJobsResponseSchema,
  createAiJobSchema,
} from './ai';

describe('createAiJobSchema', () => {
  it('validates a valid topic_deck request', () => {
    const input = {
      type: 'topic_deck',
      topic: 'Spanish greetings',
      count: 5,
      model: 'gemma4',
    };
    const result = createAiJobSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topic).toBe('Spanish greetings');
      expect(result.data.count).toBe(5);
      expect(result.data.model).toBe('gemma4');
    }
  });

  it('rejects topic_deck without topic', () => {
    const input = {
      type: 'topic_deck',
      count: 5,
    };
    const result = createAiJobSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('validates a valid text_cards request', () => {
    const input = {
      type: 'text_cards',
      sourceText: 'Some long text about plants and photosynthesis.',
      count: 4,
    };
    const result = createAiJobSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects text_cards without sourceText', () => {
    const input = {
      type: 'text_cards',
      count: 4,
    };
    const result = createAiJobSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid model names', () => {
    const input = {
      type: 'topic_deck',
      topic: 'Spanish',
      model: 'gpt-4o-mega-expensive',
    };
    const result = createAiJobSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects count < 1 or count > 20', () => {
    expect(
      createAiJobSchema.safeParse({
        type: 'topic_deck',
        topic: 'Test',
        count: 0,
      }).success,
    ).toBe(false);

    expect(
      createAiJobSchema.safeParse({
        type: 'topic_deck',
        topic: 'Test',
        count: 25,
      }).success,
    ).toBe(false);
  });

  it('accepts every configured alias', () => {
    for (const model of AI_MODELS) {
      expect(
        createAiJobSchema.safeParse({ type: 'topic_deck', topic: 'x', model })
          .success,
      ).toBe(true);
    }
  });

  it('validates a word note request and trims its word', () => {
    expect(
      createAiJobSchema.parse({
        type: 'word_note',
        deckId: 'deck-1',
        word: '  Hund  ',
        direction: 'target',
      }),
    ).toEqual({
      type: 'word_note',
      deckId: 'deck-1',
      word: 'Hund',
      direction: 'target',
    });
  });

  it('rejects an incomplete word note request', () => {
    expect(
      createAiJobSchema.safeParse({
        type: 'word_note',
        word: 'Hund',
        direction: 'target',
      }).success,
    ).toBe(false);
    expect(
      createAiJobSchema.safeParse({
        type: 'word_note',
        deckId: 'deck-1',
        word: 'Hund',
        direction: 'sideways',
      }).success,
    ).toBe(false);
  });
});

describe('aiCardOutputSchema', () => {
  it('parses a card as gemma4 returns it', () => {
    expect(
      aiCardOutputSchema.safeParse({
        front: 'What is the primary function of the Spanish preterite tense?',
        back: 'To describe actions that were completed at a specific point in the past.',
      }).success,
    ).toBe(true);
  });
});

describe('aiJobSchema', () => {
  const job = {
    id: 'j1',
    type: 'topic_deck',
    status: 'completed',
    payload: { topic: 'birds', count: 5 },
    result: [{ front: 'f', back: 'b' }],
    error: null,
    createdAt: '2026-09-04T10:00:00.000Z',
  };

  it('parses a job and strips server-only columns', () => {
    expect(aiJobSchema.parse({ ...job, attempts: 2, userId: 'u1' })).toEqual(
      job,
    );
  });

  it('rejects an unknown status', () => {
    expect(aiJobSchema.safeParse({ ...job, status: 'queued' }).success).toBe(
      false,
    );
  });

  it('parses a versioned word note candidate', () => {
    expect(
      aiJobSchema.safeParse({
        id: 'j2',
        type: 'word_note',
        status: 'completed',
        payload: {
          deckId: 'deck-1',
          word: 'Hund',
          direction: 'target',
          nativeLanguageId: 'en',
          nativeLanguageName: 'English',
          targetLanguageId: 'de',
          targetLanguageName: 'German',
        },
        result: {
          noteType: 'word',
          fieldsVersion: 1,
          fields: {
            word: 'Hund',
            translation: 'dog',
            native_language_id: 'en',
            target_language_id: 'de',
            part_of_speech: 'noun',
            example: 'Der Hund schläft.',
            example_translation: 'The dog sleeps.',
            pronunciation: 'hʊnt',
          },
        },
        error: null,
        createdAt: '2026-09-04T10:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('skips a job row this client cannot read instead of failing the list', () => {
    // a job type or fields version from a newer server
    const unknownType = { ...job, id: 'j2', type: 'image_note', result: null };
    const newerVersion = {
      ...job,
      id: 'j3',
      type: 'word_note',
      payload: {
        deckId: 'd1',
        word: 'Hund',
        direction: 'target',
        nativeLanguageId: 'n',
        nativeLanguageName: 'English',
        targetLanguageId: 't',
        targetLanguageName: 'German',
      },
      result: { noteType: 'word', fieldsVersion: 2, fields: {} },
    };
    const { jobs } = aiJobsResponseSchema.parse({
      jobs: [job, unknownType, newerVersion],
    });
    expect(jobs.map((j) => j.id)).toEqual(['j1']);
  });
});
