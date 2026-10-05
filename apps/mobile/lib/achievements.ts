import type { DatabaseManager } from '@remelondb/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useDatabase, useQuery } from '@remelondb/core/react';
import { UserBadge, type UserBadgeRecord } from '@repo/offline-db';
import { BADGE_CODES, type BadgeCode } from '@repo/offline-db/activity';

const BADGE_KEYS = {
  'first-review': 'first_review',
  'seven-day-streak': 'seven_day',
  'hundred-reviews': 'hundred_reviews',
} as const;

export interface Achievement {
  code: BadgeCode;
  name: string;
  rule: string;
  description: string;
  // When the server awarded it; null while locked
  unlockedAt: number | null;
}

// Every badge in web's order, unlocked or not. The server awards badges
// and user_badges syncs them down, so an unknown badge_id (a newer server)
// is left out rather than shown without copy.
export function achievements(
  badges: readonly Pick<UserBadgeRecord, 'badge_id' | 'unlocked_at'>[],
  t: TFunction,
): Achievement[] {
  const unlocked = new Map(
    badges.map((badge) => [badge.badge_id, badge.unlocked_at]),
  );
  return BADGE_CODES.map((code) => ({
    code,
    name: t(`dashboard.overview.badges.${BADGE_KEYS[code]}.name`),
    rule: t(`dashboard.overview.badges.${BADGE_KEYS[code]}.rule`),
    description: t(`dashboard.overview.badges.${BADGE_KEYS[code]}.description`),
    unlockedAt: unlocked.get(code) ?? null,
  }));
}

export function useAchievements(manager: DatabaseManager) {
  const { t } = useTranslation();
  const db = useDatabase(manager);
  const badges = useQuery<UserBadgeRecord>(db && db.get(UserBadge).query());

  return {
    achievements: achievements(badges.data, t),
    isLoading: !db || badges.isLoading,
    error: badges.error,
  };
}
