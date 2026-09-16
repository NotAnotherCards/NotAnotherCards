import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVIEW_PREFERENCES,
  parseReviewPreferences,
  reviewPreferencesStorageKey,
} from './review-preferences.js';

describe('parseReviewPreferences', () => {
  it('returns a saved valid value', () => {
    expect(
      parseReviewPreferences(
        '{"reviewMode":"extended","showNextReviewInterval":true}',
      ),
    ).toEqual({ reviewMode: 'extended', showNextReviewInterval: true });
  });

  it.each([
    ['nothing saved', null],
    ['malformed JSON', '{'],
    ['an unknown mode', '{"reviewMode":"hard","showNextReviewInterval":true}'],
    ['a missing field', '{"reviewMode":"basic"}'],
    ['a non-boolean flag', '{"reviewMode":"basic","showNextReviewInterval":1}'],
  ])('falls back to the defaults for %s', (_, savedValue) => {
    expect(parseReviewPreferences(savedValue)).toEqual(
      DEFAULT_REVIEW_PREFERENCES,
    );
  });
});

describe('reviewPreferencesStorageKey', () => {
  it('scopes the key to the user', () => {
    expect(reviewPreferencesStorageKey('user-1')).toBe(
      'not-another-cards:review-preferences:user-1',
    );
  });
});
