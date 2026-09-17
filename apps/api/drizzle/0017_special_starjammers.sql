CREATE TABLE "badge_awards" (
	"user_id" text NOT NULL,
	"badge_code" text NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badge_awards_user_code_pk" PRIMARY KEY("user_id","badge_code"),
	CONSTRAINT "badge_awards_code_check" CHECK ("badge_awards"."badge_code" in ('first-review', 'seven-day-streak', 'hundred-reviews'))
);
--> statement-breakpoint
CREATE TABLE "daily_challenge_completions" (
	"user_id" text NOT NULL,
	"challenge_code" text NOT NULL,
	"utc_date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_challenge_completions_user_code_date_pk" PRIMARY KEY("user_id","challenge_code","utc_date"),
	CONSTRAINT "daily_challenge_completions_code_check" CHECK ("daily_challenge_completions"."challenge_code" in ('daily-review', 'new-vocabulary'))
);
--> statement-breakpoint
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
CREATE TABLE "user_badges" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"badge_id" text NOT NULL,
	"unlocked_at" double precision NOT NULL,
	"created_at" double precision NOT NULL,
	"updated_at" double precision NOT NULL,
	CONSTRAINT "user_badges_created_at_safe_integer_check" CHECK ("user_badges"."created_at" >= 0 and "user_badges"."created_at" <= 9007199254740991 and "user_badges"."created_at" = trunc("user_badges"."created_at")),
	CONSTRAINT "user_badges_updated_at_safe_integer_check" CHECK ("user_badges"."updated_at" >= 0 and "user_badges"."updated_at" <= 9007199254740991 and "user_badges"."updated_at" = trunc("user_badges"."updated_at")),
	CONSTRAINT "user_badges_unlocked_at_safe_integer_check" CHECK ("user_badges"."unlocked_at" >= 0 and "user_badges"."unlocked_at" <= 9007199254740991 and "user_badges"."unlocked_at" = trunc("user_badges"."unlocked_at"))
);
--> statement-breakpoint
ALTER TABLE "published_decks" ADD COLUMN "moderation_status" text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "published_decks" ADD COLUMN "moderation_verdict" jsonb;--> statement-breakpoint
ALTER TABLE "published_decks" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "badge_awards" ADD CONSTRAINT "badge_awards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_challenge_completions" ADD CONSTRAINT "daily_challenge_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_reports" ADD CONSTRAINT "deck_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "badge_awards_user_awarded_idx" ON "badge_awards" USING btree ("user_id","awarded_at");--> statement-breakpoint
CREATE INDEX "daily_challenge_completions_user_date_idx" ON "daily_challenge_completions" USING btree ("user_id","utc_date");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_reports_reporter_deck_unique" ON "deck_reports" USING btree ("reporter_user_id","deck_id");--> statement-breakpoint
CREATE INDEX "deck_reports_deck_created_idx" ON "deck_reports" USING btree ("deck_id","created_at");--> statement-breakpoint
CREATE INDEX "deck_reports_reporter_created_idx" ON "deck_reports" USING btree ("reporter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "deck_takedowns_deck_created_idx" ON "deck_takedowns" USING btree ("deck_id","created_at");--> statement-breakpoint
CREATE INDEX "user_badges_user_rev_idx" ON "user_badges" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_badges_user_updated_idx" ON "user_badges" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_active_deck_moderation_unique" ON "ai_generation_jobs" USING btree (("payload" ->> 'deckId')) WHERE "ai_generation_jobs"."type" = 'deck_moderation' and "ai_generation_jobs"."status" in ('pending', 'processing');--> statement-breakpoint
ALTER TABLE "published_decks" ADD CONSTRAINT "published_decks_moderation_status_check" CHECK ("published_decks"."moderation_status" in ('visible', 'blocked'));