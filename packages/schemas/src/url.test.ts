import { describe, expect, it } from 'vitest';
import { safeUrlTestCases } from '../test/url-cases.js';
import { isSafeUrl } from './url.js';

describe('isSafeUrl', () => {
  it.each(safeUrlTestCases)('classifies %s as %j', (value, expected) => {
    expect(isSafeUrl(value)).toBe(expected);
  });
});
