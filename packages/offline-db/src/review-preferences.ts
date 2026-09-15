/** How a learner reviews: stored per user on the device, never synced. */
export type ReviewPreferences = {
  reviewMode: 'basic' | 'extended';
  showNextReviewInterval: boolean;
};

export const DEFAULT_REVIEW_PREFERENCES: Readonly<ReviewPreferences> = {
  reviewMode: 'basic',
  showNextReviewInterval: false,
};

/** The storage key both clients use, so the naming cannot drift. */
export function reviewPreferencesStorageKey(userId: string) {
  return `not-another-cards:review-preferences:${userId}`;
}

/** Reads a stored value; anything missing or malformed gives the defaults. */
export function parseReviewPreferences(
  savedValue: string | null,
): ReviewPreferences {
  if (!savedValue) return { ...DEFAULT_REVIEW_PREFERENCES };

  try {
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
