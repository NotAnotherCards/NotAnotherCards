import Storage from 'expo-sqlite/kv-store';
import {
  lastReviewDeckStorageKey,
  parseReviewPreferences,
  reviewPreferencesStorageKey,
  type ReviewPreferences,
} from '@repo/offline-db';

// Same shape as lib/theme.ts: the shared package owns the key and what a
// valid value is, this file only owns where it lives on the device. Web
// keeps the same key in localStorage; the values never sync.
export function loadReviewPreferences(userId: string): ReviewPreferences {
  return parseReviewPreferences(
    Storage.getItemSync(reviewPreferencesStorageKey(userId)),
  );
}

export function saveReviewPreferences(
  userId: string,
  preferences: ReviewPreferences,
): void {
  Storage.setItemSync(
    reviewPreferencesStorageKey(userId),
    JSON.stringify(preferences),
  );
}

export function loadLastReviewDeckId(userId: string): string | null {
  return Storage.getItemSync(lastReviewDeckStorageKey(userId));
}

export function saveLastReviewDeckId(userId: string, deckId: string): void {
  Storage.setItemSync(lastReviewDeckStorageKey(userId), deckId);
}

export function clearLastReviewDeckId(userId: string): void {
  Storage.removeItemSync(lastReviewDeckStorageKey(userId));
}
