const LAST_REVIEW_DECK_STORAGE_PREFIX = 'not-another-cards:last-review-deck:';

function getLastReviewDeckStorageKey(userId: string) {
  return `${LAST_REVIEW_DECK_STORAGE_PREFIX}${userId}`;
}

function getReviewStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getLastReviewDeckId(userId: string) {
  const storage = getReviewStorage();
  if (!storage) return null;

  try {
    return storage.getItem(getLastReviewDeckStorageKey(userId));
  } catch {
    return null;
  }
}

export function saveLastReviewDeckId(userId: string, deckId: string) {
  const storage = getReviewStorage();
  if (!storage) return;

  try {
    storage.setItem(getLastReviewDeckStorageKey(userId), deckId);
  } catch {
    // Review works without a saved local preference.
  }
}

export function clearLastReviewDeckId(userId: string) {
  const storage = getReviewStorage();
  if (!storage) return;

  try {
    storage.removeItem(getLastReviewDeckStorageKey(userId));
  } catch {
    // Review works without a saved local preference.
  }
}
