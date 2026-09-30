import { describe, expect, it } from 'vitest';

import { userProfileFormSchema } from './user-profile';

const ENGLISH = '00000000-0000-0000-0000-000000000001';
const SPANISH = '00000000-0000-0000-0000-000000000002';

describe('userProfileFormSchema', () => {
  it('passes with different native and target languages', () => {
    const result = userProfileFormSchema.safeParse({
      username: 'alex',
      native_language_id: ENGLISH,
      target_language_id: SPANISH,
    });

    expect(result.success).toBe(true);
  });

  it('fails on the target when it equals the native language', () => {
    const result = userProfileFormSchema.safeParse({
      username: 'alex',
      native_language_id: SPANISH,
      target_language_id: SPANISH,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['target_language_id'],
        message: 'profile.validation.languages_must_differ',
      }),
    ]);
  });
});
