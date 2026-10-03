import Storage from 'expo-sqlite/kv-store';
import {
  LEGACY_CARD_CONTENT_CLEANUP_VERSION,
  legacyCardContentCleanupStorageKey,
  type LegacyCardContentCleanupState,
} from '@repo/offline-db';

const completedVersions = new Map<string, number>();

export function legacyCardContentCleanupState(
  userId: string,
): LegacyCardContentCleanupState {
  const key = legacyCardContentCleanupStorageKey(userId);
  let complete =
    (completedVersions.get(userId) ?? 0) >= LEGACY_CARD_CONTENT_CLEANUP_VERSION;

  if (!complete) {
    try {
      complete =
        Number(Storage.getItemSync(key)) >= LEGACY_CARD_CONTENT_CLEANUP_VERSION;
    } catch {
      // A failed read means retry once in this app session.
    }
  }

  return {
    isComplete: () => complete,
    markComplete: () => {
      complete = true;
      completedVersions.set(userId, LEGACY_CARD_CONTENT_CLEANUP_VERSION);
      try {
        Storage.setItemSync(key, String(LEGACY_CARD_CONTENT_CLEANUP_VERSION));
      } catch {
        // The completed in-memory state still prevents repeated work here.
      }
    },
  };
}
