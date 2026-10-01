import Storage from 'expo-sqlite/kv-store';
import { legacyCardContentCleanupState } from '@/lib/legacy-card-content-cleanup';

describe('legacy card content cleanup state', () => {
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

  it('keeps completion in memory when device storage cannot save it', () => {
    const setItem = jest
      .spyOn(Storage, 'setItemSync')
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
