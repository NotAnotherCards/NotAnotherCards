import { describe, it, expect } from 'vitest';
import { AI_MODELS, MODEL_LABELS } from './ai';

describe('AI model aliases', () => {
  it('defines user-facing aliases (not provider model IDs)', () => {
    expect(AI_MODELS).toEqual(['fast', 'balanced', 'smart']);
  });

  it('has a label for every alias', () => {
    for (const model of AI_MODELS) {
      expect(MODEL_LABELS[model]).toBeDefined();
      expect(typeof MODEL_LABELS[model]).toBe('string');
      expect(MODEL_LABELS[model].length).toBeGreaterThan(0);
    }
  });
});
