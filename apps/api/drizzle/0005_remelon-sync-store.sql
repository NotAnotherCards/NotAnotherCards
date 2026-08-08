CREATE SEQUENCE "public"."remelon_rev" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "remelon_revision_checkpoints" (
	"observed_at" timestamp with time zone PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remelon_sync_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_events" DROP CONSTRAINT "rating_check";--> statement-breakpoint
ALTER TABLE "review_events" DROP CONSTRAINT "review_events_user_card_id_user_cards_id_fk";
--> statement-breakpoint
ALTER TABLE "user_cards" DROP CONSTRAINT "user_cards_deck_id_user_decks_id_fk";
--> statement-breakpoint
DROP INDEX "idx_review_events_user_card";--> statement-breakpoint
DROP INDEX "user_username_idx";--> statement-breakpoint
DROP INDEX "idx_user_cards_user_updated";--> statement-breakpoint
DROP INDEX "idx_user_cards_due";--> statement-breakpoint
DROP INDEX "idx_user_decks_user_updated";--> statement-breakpoint
ALTER TABLE "review_events" ALTER COLUMN "reviewed_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "review_events" ALTER COLUMN "reviewed_at" SET DATA TYPE double precision USING floor(extract(epoch FROM "reviewed_at") * 1000)::double precision;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "due_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "due_at" SET DATA TYPE double precision USING floor(extract(epoch FROM "due_at") * 1000)::double precision;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "created_at" SET DATA TYPE double precision USING floor(extract(epoch FROM "created_at") * 1000)::double precision;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "updated_at" SET DATA TYPE double precision USING floor(extract(epoch FROM "updated_at") * 1000)::double precision;--> statement-breakpoint
ALTER TABLE "user_decks" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_decks" ALTER COLUMN "created_at" SET DATA TYPE double precision USING floor(extract(epoch FROM "created_at") * 1000)::double precision;--> statement-breakpoint
ALTER TABLE "user_decks" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_decks" ALTER COLUMN "updated_at" SET DATA TYPE double precision USING floor(extract(epoch FROM "updated_at") * 1000)::double precision;--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "rev" bigint;--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "rev" bigint;--> statement-breakpoint
ALTER TABLE "user_decks" ADD COLUMN "rev" bigint;--> statement-breakpoint
UPDATE "user_decks" SET "rev" = nextval('remelon_rev');--> statement-breakpoint
UPDATE "user_cards" SET "rev" = nextval('remelon_rev');--> statement-breakpoint
UPDATE "review_events" SET "rev" = nextval('remelon_rev');--> statement-breakpoint
ALTER TABLE "user_decks" ALTER COLUMN "rev" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "rev" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review_events" ALTER COLUMN "rev" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "remelon_revision_checkpoints_observed_at_idx" ON "remelon_revision_checkpoints" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "review_events_user_rev_idx" ON "review_events" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "review_events_user_card_idx" ON "review_events" USING btree ("user_id","user_card_id");--> statement-breakpoint
CREATE INDEX "user_cards_user_rev_idx" ON "user_cards" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_cards_user_updated_idx" ON "user_cards" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "user_cards_user_due_idx" ON "user_cards" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "user_decks_user_rev_idx" ON "user_decks" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_decks_user_updated_idx" ON "user_decks" USING btree ("user_id","updated_at");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_rating_check" CHECK ("review_events"."rating" between 1 and 4);--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_reviewed_at_safe_integer_check" CHECK ("review_events"."reviewed_at" >= 0 and "review_events"."reviewed_at" <= 9007199254740991 and "review_events"."reviewed_at" = trunc("review_events"."reviewed_at"));--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_due_at_safe_integer_check" CHECK ("user_cards"."due_at" >= 0 and "user_cards"."due_at" <= 9007199254740991 and "user_cards"."due_at" = trunc("user_cards"."due_at"));--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_created_at_safe_integer_check" CHECK ("user_cards"."created_at" >= 0 and "user_cards"."created_at" <= 9007199254740991 and "user_cards"."created_at" = trunc("user_cards"."created_at"));--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_updated_at_safe_integer_check" CHECK ("user_cards"."updated_at" >= 0 and "user_cards"."updated_at" <= 9007199254740991 and "user_cards"."updated_at" = trunc("user_cards"."updated_at"));--> statement-breakpoint
ALTER TABLE "user_decks" ADD CONSTRAINT "user_decks_created_at_safe_integer_check" CHECK ("user_decks"."created_at" >= 0 and "user_decks"."created_at" <= 9007199254740991 and "user_decks"."created_at" = trunc("user_decks"."created_at"));--> statement-breakpoint
ALTER TABLE "user_decks" ADD CONSTRAINT "user_decks_updated_at_safe_integer_check" CHECK ("user_decks"."updated_at" >= 0 and "user_decks"."updated_at" <= 9007199254740991 and "user_decks"."updated_at" = trunc("user_decks"."updated_at"));
