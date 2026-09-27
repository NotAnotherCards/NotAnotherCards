-- Custom SQL migration file, put you code below! --
INSERT INTO "public"."user_badges" ("id", "user_id", "badge_id", "rev", "unlocked_at", "created_at", "updated_at")
SELECT gen_random_uuid(), "user_id", "badge_code", nextval('remelon_rev'), extract(epoch from "awarded_at") * 1000, extract(epoch from "awarded_at") * 1000, extract(epoch from "awarded_at") * 1000
FROM "public"."badge_awards"
ON CONFLICT ("user_id", "badge_id") DO NOTHING;