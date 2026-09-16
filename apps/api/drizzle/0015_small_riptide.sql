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
ALTER TABLE "badge_awards" ADD CONSTRAINT "badge_awards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_challenge_completions" ADD CONSTRAINT "daily_challenge_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "badge_awards_user_awarded_idx" ON "badge_awards" USING btree ("user_id","awarded_at");--> statement-breakpoint
CREATE INDEX "daily_challenge_completions_user_date_idx" ON "daily_challenge_completions" USING btree ("user_id","utc_date");