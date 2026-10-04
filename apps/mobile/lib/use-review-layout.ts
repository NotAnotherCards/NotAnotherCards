import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReviewAnswer, ReviewPreferences } from '@repo/offline-db';
import {
  loadReviewPreferences,
  saveReviewPreferences,
} from './review-preferences';

// Web's two modes, same labels: basic asks whether you knew it, extended
// keeps the four scheduler ratings apart. Settings stores the choice.
const BASIC_ANSWERS: ReviewAnswer[] = ['forgot', 'remember'];
const EXTENDED_ANSWERS: ReviewAnswer[] = [
  'forgot',
  'hard',
  'remember',
  'very-easy',
];

// A long press on an answer steps through the three layouts. Basic with
// intervals, which settings allow, joins at basic and never comes back
// from the cycle: two answers do not need the extra line.
function nextLayout(preferences: ReviewPreferences): ReviewPreferences {
  if (preferences.reviewMode === 'basic') {
    return { reviewMode: 'extended', showNextReviewInterval: false };
  }
  if (!preferences.showNextReviewInterval) {
    return { reviewMode: 'extended', showNextReviewInterval: true };
  }
  return { reviewMode: 'basic', showNextReviewInterval: false };
}

const layoutName = (preferences: ReviewPreferences) =>
  preferences.reviewMode === 'basic'
    ? 'mobile.messages.two_answers'
    : preferences.showNextReviewInterval
      ? 'mobile.messages.four_intervals'
      : 'mobile.messages.four_answers';

// How the answers are laid out in a review, and the switch between the
// layouts. Held here, not read once: the long press changes it mid-session,
// and saving it keeps settings and the next review in step.
export function useReviewLayout(userId: string) {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState(() =>
    loadReviewPreferences(userId),
  );
  // The new layout's name, shown for a moment after a switch.
  const [hint, setHint] = useState<ReturnType<typeof layoutName> | null>(null);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 2000);
    return () => clearTimeout(timer);
  }, [hint]);

  const switchLayout = () => {
    const next = nextLayout(preferences);
    setPreferences(next);
    if (userId) saveReviewPreferences(userId, next);
    setHint(layoutName(next));
  };

  return {
    extended: preferences.reviewMode === 'extended',
    showIntervals: preferences.showNextReviewInterval,
    answers:
      preferences.reviewMode === 'extended' ? EXTENDED_ANSWERS : BASIC_ANSWERS,
    hint: hint ? t(hint) : null,
    nextName: t(layoutName(nextLayout(preferences))),
    switchLayout,
  };
}

export type ReviewLayout = ReturnType<typeof useReviewLayout>;
