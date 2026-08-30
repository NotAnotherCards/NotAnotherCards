import { describe, it, expect } from 'vitest';
import { AI_MODELS, aiCardOutputSchema, createAiJobSchema } from './ai';

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

  it('accepts every configured alias, including the deprecated qwen', () => {
    expect(AI_MODELS).toContain('qwen');
    for (const model of AI_MODELS) {
      expect(
        createAiJobSchema.safeParse({ type: 'topic_deck', topic: 'x', model })
          .success,
      ).toBe(true);
    }
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
