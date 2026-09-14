import { isSafeUrl } from '@repo/schemas';
import { safeUrlTestCases } from '../../../packages/schemas/test/url-cases';

describe('isSafeUrl in React Native', () => {
  it.each(safeUrlTestCases)('classifies %s as %j', (value, expected) => {
    expect(isSafeUrl(value)).toBe(expected);
  });
});
