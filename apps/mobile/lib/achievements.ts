import type { DatabaseManager } from '@remelondb/core';
import { useDatabase, useQuery } from '@remelondb/core/react';
import { UserBadge, type UserBadgeRecord } from '@repo/offline-db';
import { BADGE_CODES, type BadgeCode } from '@repo/offline-db/activity';

// Web's badge copy (Overview's BADGES), word for word; both move to the
// translation catalogs with the i18n work (#279).
const BADGE_COPY: Record<
  BadgeCode,
  { name: string; rule: string; description: string }
> = {
  'first-review': {
    name: 'First Step',
    rule: 'Complete your first review',
    description: 'The journey of a thousand miles begins with a single step.',
  },
  'seven-day-streak': {
    name: 'Week Warrior',
    rule: '7-day streak',
    description: 'You reviewed 7 days in a row! Consistency is key.',
  },
  'hundred-reviews': {
    name: 'Century Mark',
    rule: '100 distinct reviews',
    description:
      'You have completed 100 distinct reviews. Incredible dedication!',
  },
};

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
): Achievement[] {
  const unlocked = new Map(
    badges.map((badge) => [badge.badge_id, badge.unlocked_at]),
  );
  return BADGE_CODES.map((code) => ({
    code,
    ...BADGE_COPY[code],
    unlockedAt: unlocked.get(code) ?? null,
  }));
}

export function useAchievements(manager: DatabaseManager) {
  const db = useDatabase(manager);
  const badges = useQuery<UserBadgeRecord>(db && db.get(UserBadge).query());

  return {
    achievements: achievements(badges.data),
    isLoading: !db || badges.isLoading,
    error: badges.error,
  };
}
