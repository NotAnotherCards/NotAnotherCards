import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

config({ path: resolve(__dirname, '../.env') });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { badgeAwards } from '../src/gamification/schema';
import { userBadges } from '../src/sync/schema';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in apps/api/.env');
  }

  console.log('Connecting to database for badge backfill...');
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const existingAwards = await db.select().from(badgeAwards);
    console.log(
      `Found ${existingAwards.length} existing badge awards to backfill.`,
    );

    if (existingAwards.length > 0) {
      await db.transaction(async (tx) => {
        const values = existingAwards.map((award) => {
          const unlockedAt = award.awardedAt.getTime();
          return {
            id: randomUUID(),
            rev: sql<number>`nextval('remelon_rev')`,
            userId: award.userId,
            badgeId: award.badgeCode,
            unlockedAt,
            createdAt: unlockedAt,
            updatedAt: unlockedAt,
          };
        });

        await tx
          .insert(userBadges)
          .values(values)
          .onConflictDoNothing({
            target: [userBadges.userId, userBadges.badgeId],
          });
      });
      console.log('Successfully backfilled badges into user_badges!');
    }
  } catch (error) {
    console.error('Error backfilling badges:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
