const LAST_REVIEW_DECK_STORAGE_PREFIX = 'not-another-cards:last-review-deck:';
const REVIEW_PREFERENCES_STORAGE_PREFIX =
  'not-another-cards:review-preferences:';

export type ReviewPreferences = {
  reviewMode: 'basic' | 'extended';
  showNextReviewInterval: boolean;
};

export const DEFAULT_REVIEW_PREFERENCES: Readonly<ReviewPreferences> = {
  reviewMode: 'basic',
  showNextReviewInterval: false,
};

function getLastReviewDeckStorageKey(userId: string) {
  return `${LAST_REVIEW_DECK_STORAGE_PREFIX}${userId}`;
}

function getReviewPreferencesStorageKey(userId: string) {
  return `${REVIEW_PREFERENCES_STORAGE_PREFIX}${userId}`;
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

export function getReviewPreferences(
  userId: string | undefined,
): ReviewPreferences {
  if (!userId) return { ...DEFAULT_REVIEW_PREFERENCES };

  const storage = getReviewStorage();
  if (!storage) return { ...DEFAULT_REVIEW_PREFERENCES };

  try {
    const savedValue = storage.getItem(getReviewPreferencesStorageKey(userId));
    if (!savedValue) return { ...DEFAULT_REVIEW_PREFERENCES };

    const parsedValue: unknown = JSON.parse(savedValue);
    if (
      !parsedValue ||
      typeof parsedValue !== 'object' ||
      !('reviewMode' in parsedValue) ||
      !('showNextReviewInterval' in parsedValue) ||
      (parsedValue.reviewMode !== 'basic' &&
        parsedValue.reviewMode !== 'extended') ||
      typeof parsedValue.showNextReviewInterval !== 'boolean'
    ) {
      return { ...DEFAULT_REVIEW_PREFERENCES };
    }

    return {
      reviewMode: parsedValue.reviewMode,
      showNextReviewInterval: parsedValue.showNextReviewInterval,
    };
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
      getReviewPreferencesStorageKey(userId),
      JSON.stringify(preferences),
    );
  } catch {
    // Review works without saved browser preferences.
  }
}
