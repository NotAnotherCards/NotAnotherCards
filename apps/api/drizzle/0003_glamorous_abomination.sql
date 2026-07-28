ALTER TABLE "user_decks" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
UPDATE "user_decks" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
ALTER TABLE "user_decks" ALTER COLUMN "updated_at" SET NOT NULL;
