ALTER TABLE "review_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_cards" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_decks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "review_events" CASCADE;--> statement-breakpoint
DROP TABLE "user_cards" CASCADE;--> statement-breakpoint
DROP TABLE "user_decks" CASCADE;--> statement-breakpoint
DROP INDEX "user_username_idx";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");