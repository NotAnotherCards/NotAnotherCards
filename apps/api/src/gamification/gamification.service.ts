import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  BADGE_CODES,
  selectActivitySummary,
  selectDailyChallengeHistory,
} from '@repo/offline-db/activity';
import type {
  GamificationLeaderboard,
  GamificationMe,
  LeaderboardEntry,
} from '@repo/schemas';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { AppDatabase } from '../database/database-schema';
import {
  reviewEvents,
  userCards,
  userNotes,
  userProfiles,
  userBadges,
} from '../sync/schema';
import { syncScopeLockKey } from '../sync/sync-store';
import { badgeAwards, dailyChallengeCompletions } from './schema';

type AppTransaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

interface RankedUser {
  readonly userId: string;
  readonly username: string;
  readonly points: number;
  readonly rank: number;
}

@Injectable()
export class GamificationService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: AppDatabase,
  ) {}

  async refreshAwards(
    userId: string,
    now: number = Date.now(),
  ): Promise<GamificationMe> {
    return this.db.transaction(async (tx) => {
      // Sync pushes use the same key. A summary therefore observes either
      // the complete prior push or the complete next one, never half of it.
      await tx.execute(
        sql`select pg_advisory_xact_lock(${syncScopeLockKey(userId).toString()})`,
      );

      const { me } = await this.refreshAwardsInTransaction(tx, userId, now);
      return me;
    });
  }

  async refreshAwardsInTransaction(
    tx: AppTransaction,
    userId: string,
    now: number = Date.now(),
  ): Promise<{ me: GamificationMe; newlyUnlocked: typeof userBadges.$inferSelect[] }> {
    const records = await this.activityRecords(tx, userId);
    const summary = selectActivitySummary({ ...records, now });
    const awardedAt = new Date(now);
    let newlyUnlocked: typeof userBadges.$inferSelect[] = [];

    if (summary.eligibleBadgeCodes.length > 0) {
      const inserted = await tx
        .insert(badgeAwards)
        .values(
          summary.eligibleBadgeCodes.map((badgeCode) => ({
            userId,
            badgeCode,
            awardedAt,
          })),
        )
        .onConflictDoNothing()
        .returning({ badgeCode: badgeAwards.badgeCode });

      if (inserted.length > 0) {
        newlyUnlocked = await tx
          .insert(userBadges)
          .values(
            inserted.map(({ badgeCode }) => ({
              id: randomUUID(),
              rev: sql<number>`nextval('remelon_rev')`,
              userId,
              badgeId: badgeCode,
              unlockedAt: now,
              createdAt: now,
              updatedAt: now,
            })),
          )
          .onConflictDoNothing({
            target: [userBadges.userId, userBadges.badgeId],
          })
          .returning();
      }
    }

    const completedChallenges = selectDailyChallengeHistory(
      records.reviewEvents,
      records.notes,
      now,
    ).flatMap((day) =>
      day.challenges
        .filter((challenge) => challenge.completed)
        .map((challenge) => ({ ...challenge, utcDate: day.utcDate })),
    );
    if (completedChallenges.length > 0) {
      await tx
        .insert(dailyChallengeCompletions)
        .values(
          completedChallenges.map((challenge) => ({
            userId,
            challengeCode: challenge.code,
            utcDate: challenge.utcDate,
            completedAt: awardedAt,
          })),
        )
        .onConflictDoNothing();
    }

    const persistedBadges = await tx
      .select({
        code: badgeAwards.badgeCode,
        awardedAt: badgeAwards.awardedAt,
      })
      .from(badgeAwards)
      .where(eq(badgeAwards.userId, userId));
    const persistedChallenges = await tx
      .select({
        code: dailyChallengeCompletions.challengeCode,
        completedAt: dailyChallengeCompletions.completedAt,
      })
      .from(dailyChallengeCompletions)
      .where(
        and(
          eq(dailyChallengeCompletions.userId, userId),
          eq(dailyChallengeCompletions.utcDate, summary.utcDate),
        ),
      );

    const badgeByCode = new Map(
      persistedBadges.map((award) => [award.code, award.awardedAt]),
    );
    const challengeByCode = new Map(
      persistedChallenges.map((completion) => [
        completion.code,
        completion.completedAt,
      ]),
    );

    const me = {
      utcDate: summary.utcDate,
      points: summary.reviewPoints,
      reviewCount: summary.reviewCount,
      learnedNoteCount: summary.learnedNoteCount,
      currentStreak: summary.currentStreak,
      longestStreak: summary.longestStreak,
      badges: BADGE_CODES.flatMap((code) => {
        const timestamp = badgeByCode.get(code);
        return timestamp ? [{ code, awardedAt: timestamp.getTime() }] : [];
      }),
      todayChallenges: summary.todayChallenges.map((challenge) => {
        const completedAt = challengeByCode.get(challenge.code);
        return {
          ...challenge,
          completed: challenge.completed || completedAt !== undefined,
          completedAt: completedAt?.getTime() ?? null,
        };
      }),
    };
    return { me, newlyUnlocked };
  }

  async leaderboard(
    currentUserId: string,
    limit: number,
    offset: number,
  ): Promise<GamificationLeaderboard> {
    return this.db.transaction(
      async (tx) => {
        const scores = tx
          .select({
            userId: userProfiles.userId,
            username: sql<string>`${userProfiles.username}`.as('username'),
            points: sql<number>`count(${reviewEvents.id})::integer`.as(
              'points',
            ),
            reachedAt: sql<number | null>`max(${reviewEvents.reviewedAt})`.as(
              'reached_at',
            ),
          })
          .from(userProfiles)
          .leftJoin(
            reviewEvents,
            and(
              eq(reviewEvents.userId, userProfiles.userId),
              isNull(reviewEvents.deletedAt),
            ),
          )
          .where(
            and(
              isNull(userProfiles.deletedAt),
              isNotNull(userProfiles.username),
            ),
          )
          .groupBy(userProfiles.userId, userProfiles.username)
          .as('gamification_scores');

        const ranked = tx
          .select({
            userId: scores.userId,
            username: scores.username,
            points: scores.points,
            rank: sql<number>`row_number() over (
              order by ${scores.points} desc,
                ${scores.reachedAt} asc nulls last,
                ${scores.username} asc
            )::integer`.as('rank'),
          })
          .from(scores)
          .as('gamification_ranked');

        const page = await tx
          .select()
          .from(ranked)
          .orderBy(asc(ranked.rank))
          .limit(limit)
          .offset(offset);
        const [currentUser] = await tx
          .select()
          .from(ranked)
          .where(eq(ranked.userId, currentUserId))
          .limit(1);

        return {
          entries: page.map((row) => this.publicRank(row, currentUserId)),
          currentUser: currentUser
            ? this.publicRank(currentUser, currentUserId)
            : null,
          limit,
          offset,
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  private publicRank(row: RankedUser, currentUserId: string): LeaderboardEntry {
    return {
      rank: Number(row.rank),
      username: row.username,
      points: Number(row.points),
      isCurrentUser: row.userId === currentUserId,
    };
  }

  private async activityRecords(tx: AppTransaction, userId: string) {
    const reviewEventsForUser = await tx
      .select({
        id: reviewEvents.id,
        user_card_id: reviewEvents.userCardId,
        rating: reviewEvents.rating,
        reviewed_at: reviewEvents.reviewedAt,
      })
      .from(reviewEvents)
      .where(
        and(eq(reviewEvents.userId, userId), isNull(reviewEvents.deletedAt)),
      );
    const cards = await tx
      .select({
        id: userCards.id,
        note_id: userCards.noteId,
        active: userCards.active,
      })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), isNull(userCards.deletedAt)));
    const notes = await tx
      .select({ id: userNotes.id, created_at: userNotes.createdAt })
      .from(userNotes)
      .where(and(eq(userNotes.userId, userId), isNull(userNotes.deletedAt)));

    return { reviewEvents: reviewEventsForUser, cards, notes };
  }
}
