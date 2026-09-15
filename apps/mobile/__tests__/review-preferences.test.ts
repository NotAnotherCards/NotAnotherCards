import { DEFAULT_REVIEW_PREFERENCES } from '@repo/offline-db';
import {
  loadReviewPreferences,
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
