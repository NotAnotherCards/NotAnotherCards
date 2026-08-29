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

  return storage.getItem(getLastReviewDeckStorageKey(userId));
}

export function saveLastReviewDeckId(userId: string, deckId: string) {
  const storage = getReviewStorage();
  if (!storage) return;

  storage.setItem(getLastReviewDeckStorageKey(userId), deckId);
}

export function clearLastReviewDeckId(userId: string) {
  const storage = getReviewStorage();
  if (!storage) return;

  storage.removeItem(getLastReviewDeckStorageKey(userId));
}
