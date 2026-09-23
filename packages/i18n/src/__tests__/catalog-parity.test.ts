import { describe, expect, it } from 'vitest';
import en from '../catalogs/en.json';
import es from '../catalogs/es.json';
import de from '../catalogs/de.json';

function checkKeysParity(
  source: Record<string, any>,
  target: Record<string, any>,
  path: string = '',
) {
  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;
    expect(target, `Missing key in target: ${currentPath}`).toHaveProperty(key);

    if (typeof source[key] === 'object' && source[key] !== null) {
      expect(typeof target[key]).toBe('object');
      checkKeysParity(source[key], target[key], currentPath);
    }
  }
}

describe('i18n catalog parity', () => {
  it('es should have all keys from en', () => {
    checkKeysParity(en, es);
  });

  it('de should have all keys from en', () => {
    checkKeysParity(en, de);
  });
});
