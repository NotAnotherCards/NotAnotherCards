import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacyCardContentCleanupState } from '@/lib/legacy-card-content-cleanup';

describe('legacy card content cleanup state', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps a completed cleanup separate for each user', () => {
    const first = legacyCardContentCleanupState('cleanup-user-1');
    first.markComplete();

    expect(legacyCardContentCleanupState('cleanup-user-1').isComplete()).toBe(
      true,
    );
    expect(legacyCardContentCleanupState('cleanup-user-2').isComplete()).toBe(
      false,
    );
  });

  it('keeps completion in memory when browser storage cannot save it', () => {
    const setItem = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('Storage access denied');
      });

    legacyCardContentCleanupState('cleanup-storage-error').markComplete();

    expect(
      legacyCardContentCleanupState('cleanup-storage-error').isComplete(),
    ).toBe(true);
    setItem.mockRestore();
  });
});
