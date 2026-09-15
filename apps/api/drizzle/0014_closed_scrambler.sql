CREATE TABLE "deck_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"snapshot_published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_takedowns" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"source" text NOT NULL,
	"reason" text,
	"verdict" jsonb NOT NULL,
	"snapshot_published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_takedowns_source_check" CHECK ("deck_takedowns"."source" in ('automatic', 'operator'))
);
--> statement-breakpoint
ALTER TABLE "published_decks" ADD COLUMN "moderation_status" text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "published_decks" ADD COLUMN "moderation_verdict" jsonb;--> statement-breakpoint
ALTER TABLE "published_decks" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deck_reports" ADD CONSTRAINT "deck_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_reports_reporter_deck_unique" ON "deck_reports" USING btree ("reporter_user_id","deck_id");--> statement-breakpoint
CREATE INDEX "deck_reports_deck_created_idx" ON "deck_reports" USING btree ("deck_id","created_at");--> statement-breakpoint
CREATE INDEX "deck_reports_reporter_created_idx" ON "deck_reports" USING btree ("reporter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "deck_takedowns_deck_created_idx" ON "deck_takedowns" USING btree ("deck_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_active_deck_moderation_unique" ON "ai_generation_jobs" USING btree (("payload" ->> 'deckId')) WHERE "ai_generation_jobs"."type" = 'deck_moderation' and "ai_generation_jobs"."status" in ('pending', 'processing');--> statement-breakpoint
ALTER TABLE "published_decks" ADD CONSTRAINT "published_decks_moderation_status_check" CHECK ("published_decks"."moderation_status" in ('visible', 'blocked'));