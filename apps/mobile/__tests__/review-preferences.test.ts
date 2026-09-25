import { DEFAULT_REVIEW_PREFERENCES } from '@repo/offline-db';
import {
  loadLastReviewDeckId,
  loadReviewPreferences,
  saveLastReviewDeckId,
  saveReviewPreferences,
} from '@/lib/review-preferences';

describe('review preferences storage', () => {
  it('returns the defaults for a user who never saved anything', () => {
    expect(loadReviewPreferences('user-new')).toEqual(
      DEFAULT_REVIEW_PREFERENCES,
    );
  });

  it('round-trips a saved value per user', () => {
    saveReviewPreferences('user-1', {
      reviewMode: 'extended',
      showNextReviewInterval: true,
    });
    expect(loadReviewPreferences('user-1')).toEqual({
      reviewMode: 'extended',
      showNextReviewInterval: true,
    });
    expect(loadReviewPreferences('user-2')).toEqual(DEFAULT_REVIEW_PREFERENCES);
  });
});

describe('last review deck storage', () => {
  it('round-trips a deck per user', () => {
    saveLastReviewDeckId('review-user-1', 'deck-german');
    saveLastReviewDeckId('review-user-2', 'deck-spanish');

    expect(loadLastReviewDeckId('review-user-1')).toBe('deck-german');
    expect(loadLastReviewDeckId('review-user-2')).toBe('deck-spanish');
  });
});
