DELETE FROM "user_badges"
WHERE "id" IN (
    SELECT "id"
    FROM (
        SELECT "id",
               ROW_NUMBER() OVER (PARTITION BY "user_id", "badge_id" ORDER BY "created_at" ASC) as rnum
        FROM "user_badges"
    ) t
    WHERE t.rnum > 1
);
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_badge_uk" UNIQUE("user_id","badge_id");