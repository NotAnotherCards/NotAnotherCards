import {
  DEFAULT_REVIEW_PREFERENCES,
  parseReviewPreferences,
  reviewPreferencesStorageKey,
  type ReviewPreferences,
} from '@repo/offline-db';

export {
  DEFAULT_REVIEW_PREFERENCES,
  type ReviewPreferences,
} from '@repo/offline-db';

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

export function getReviewPreferences(
  userId: string | undefined,
): ReviewPreferences {
  if (!userId) return { ...DEFAULT_REVIEW_PREFERENCES };

  const storage = getReviewStorage();
  if (!storage) return { ...DEFAULT_REVIEW_PREFERENCES };

  try {
    return parseReviewPreferences(
      storage.getItem(reviewPreferencesStorageKey(userId)),
    );
  } catch {
    return { ...DEFAULT_REVIEW_PREFERENCES };
  }
}

export function saveReviewPreferences(
  userId: string | undefined,
  preferences: ReviewPreferences,
) {
  if (!userId) return;

  const storage = getReviewStorage();
  if (!storage) return;

  try {
    storage.setItem(
      reviewPreferencesStorageKey(userId),
      JSON.stringify(preferences),
    );
  } catch {
    // Review works without saved browser preferences.
  }
}
