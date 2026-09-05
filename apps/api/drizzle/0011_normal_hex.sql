--> note_type is added nullable, backfilled, then made NOT NULL: `ADD COLUMN
--> ... NOT NULL` without a default fails outright on a table that already has
--> rows. Every deck that existed before this holds basic notes.
ALTER TABLE "user_decks" ADD COLUMN "note_type" text;--> statement-breakpoint
UPDATE "user_decks" SET "note_type" = 'basic' WHERE "note_type" IS NULL;--> statement-breakpoint
ALTER TABLE "user_decks" ALTER COLUMN "note_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_decks" ADD COLUMN "native_language_id" uuid;--> statement-breakpoint
ALTER TABLE "user_decks" ADD COLUMN "target_language_id" uuid;--> statement-breakpoint
ALTER TABLE "user_decks" ADD CONSTRAINT "user_decks_languages_match_note_type_check" CHECK (case when "user_decks"."note_type" = 'word' then "user_decks"."native_language_id" is not null and "user_decks"."target_language_id" is not null and "user_decks"."native_language_id" <> "user_decks"."target_language_id" else "user_decks"."native_language_id" is null and "user_decks"."target_language_id" is null end);
