import { userAdditionalFields } from '../auth/auth-fields';

describe('better-auth additional user fields', () => {
  it('keeps onBoardingComplete server-owned', () => {
    // Without input: false, Better Auth accepts the field from the
    // signup body and a crafted request skips onboarding entirely.
    expect(userAdditionalFields.onBoardingComplete.input).toBe(false);
  });
});
