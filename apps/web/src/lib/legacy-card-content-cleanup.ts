import {
  LEGACY_CARD_CONTENT_CLEANUP_VERSION,
  legacyCardContentCleanupStorageKey,
  type LegacyCardContentCleanupState,
} from '@repo/offline-db';

const completedVersions = new Map<string, number>();

function storage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function legacyCardContentCleanupState(
  userId: string,
): LegacyCardContentCleanupState {
  const key = legacyCardContentCleanupStorageKey(userId);
  let complete =
    (completedVersions.get(userId) ?? 0) >= LEGACY_CARD_CONTENT_CLEANUP_VERSION;

  if (!complete) {
    try {
      complete =
        Number(storage()?.getItem(key)) >= LEGACY_CARD_CONTENT_CLEANUP_VERSION;
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
        storage()?.setItem(key, String(LEGACY_CARD_CONTENT_CLEANUP_VERSION));
      } catch {
        // The completed in-memory state still prevents repeated work here.
      }
    },
  };
}
