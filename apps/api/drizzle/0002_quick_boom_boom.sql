CREATE TYPE "public"."card_type" AS ENUM('WORD', 'COMPARISON', 'PHRASE');--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_card_id" text NOT NULL,
	"rating" integer NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"deck_id" text NOT NULL,
	"card_type" "card_type" DEFAULT 'WORD' NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"context_sentence" text,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_user_card_id_user_cards_id_fk" FOREIGN KEY ("user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_deck_id_user_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."user_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_decks" ADD CONSTRAINT "user_decks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_review_events_user_card" ON "review_events" USING btree ("user_id","user_card_id");--> statement-breakpoint
CREATE INDEX "idx_user_cards_user_updated" ON "user_cards" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_user_cards_due" ON "user_cards" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "idx_user_decks_user_updated" ON "user_decks" USING btree ("user_id","updated_at");