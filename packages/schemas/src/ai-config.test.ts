import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { AI_MODELS } from './ai';

const NON_GENERATORS = ['embeddings', 'moderation', 'fact-check'];

describe('litellm config', () => {
  it('lists exactly the models in AI_MODELS', () => {
    const yaml = readFileSync(
      new URL('../../../infra/gx10/litellm-config.yaml', import.meta.url),
      'utf8',
    );
    const aliases = [...yaml.matchAll(/^\s*-\s*model_name:\s*(\S+)/gm)].map(
      (m) => m[1],
    );
    const generators = aliases.filter((a) => !NON_GENERATORS.includes(a));
    expect(new Set(generators)).toEqual(new Set(AI_MODELS));
  });
});
