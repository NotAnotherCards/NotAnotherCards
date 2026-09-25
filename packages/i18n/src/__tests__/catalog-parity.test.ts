import { describe, expect, it } from 'vitest';
import en from '../catalogs/en.json';
import es from '../catalogs/es.json';
import de from '../catalogs/de.json';
import ru from '../catalogs/ru.json';

function checkKeysParity(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  path: string = '',
) {
  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;
    expect(target, `Missing key in target: ${currentPath}`).toHaveProperty(key);

    if (typeof source[key] === 'object' && source[key] !== null) {
      expect(typeof target[key]).toBe('object');
      checkKeysParity(
        source[key] as Record<string, unknown>,
        target[key] as Record<string, unknown>,
        currentPath,
      );
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
  it('es should not have extra keys missing from en', () => {
    checkKeysParity(es, en);
  });

  it('de should not have extra keys missing from en', () => {
    checkKeysParity(de, en);
  });

  it('ru should have all keys from en', () => {
    checkKeysParity(en, ru);
  });

  it('ru should not have extra keys missing from en', () => {
    checkKeysParity(ru, en);
  });
});
