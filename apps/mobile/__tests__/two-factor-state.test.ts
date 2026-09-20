const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockDeleteItem = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItem(...args),
  setItemAsync: (...args: unknown[]) => mockSetItem(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItem(...args),
}));

import {
  beginTwoFactorChallenge,
  finishTwoFactorChallenge,
  getTwoFactorChallengeState,
  hydrateTwoFactorChallenge,
  isTwoFactorRequiredParam,
} from '@/lib/two-factor-challenge';

describe('persisted two-factor challenge state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockDeleteItem.mockResolvedValue(undefined);
  });

  it('restores a pending challenge after a process restart', async () => {
    mockGetItem.mockResolvedValueOnce('true');

    await expect(hydrateTwoFactorChallenge()).resolves.toEqual({
      pending: true,
      hydrated: true,
    });
    expect(mockGetItem).toHaveBeenCalledWith(
      'notanothercards.pending-two-factor',
    );
  });

  it('persists begin and removes the marker when the challenge finishes', () => {
    beginTwoFactorChallenge();
    expect(mockSetItem).toHaveBeenCalledWith(
      'notanothercards.pending-two-factor',
      'true',
    );

    finishTwoFactorChallenge();
    expect(getTwoFactorChallengeState().pending).toBe(false);
    expect(mockDeleteItem).toHaveBeenCalledWith(
      'notanothercards.pending-two-factor',
    );
  });

  it('recognizes Expo OAuth callback flags', () => {
    expect(isTwoFactorRequiredParam('true')).toBe(true);
    expect(isTwoFactorRequiredParam(['false', 'true'])).toBe(true);
    expect(isTwoFactorRequiredParam('false')).toBe(false);
    expect(isTwoFactorRequiredParam(undefined)).toBe(false);
  });
});
