ALTER TABLE "user_cards" DROP COLUMN "card_type";--> statement-breakpoint
ALTER TABLE "user_cards" DROP COLUMN "context_sentence";--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "rating_check" CHECK ("review_events"."rating" >= 1 AND "review_events"."rating" <= 4);--> statement-breakpoint
DROP TYPE "public"."card_type";