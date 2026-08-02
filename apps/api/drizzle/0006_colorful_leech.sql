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
CREATE TABLE "review_events" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"user_card_id" text NOT NULL,
	"rating" integer NOT NULL,
	"reviewed_at" double precision NOT NULL,
	CONSTRAINT "review_events_rating_check" CHECK ("review_events"."rating" between 1 and 4),
	CONSTRAINT "review_events_reviewed_at_safe_integer_check" CHECK ("review_events"."reviewed_at" >= 0 and "review_events"."reviewed_at" <= 9007199254740991 and "review_events"."reviewed_at" = trunc("review_events"."reviewed_at"))
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"deck_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"due_at" double precision NOT NULL,
	"created_at" double precision NOT NULL,
	"updated_at" double precision NOT NULL,
	CONSTRAINT "user_cards_due_at_safe_integer_check" CHECK ("user_cards"."due_at" >= 0 and "user_cards"."due_at" <= 9007199254740991 and "user_cards"."due_at" = trunc("user_cards"."due_at")),
	CONSTRAINT "user_cards_created_at_safe_integer_check" CHECK ("user_cards"."created_at" >= 0 and "user_cards"."created_at" <= 9007199254740991 and "user_cards"."created_at" = trunc("user_cards"."created_at")),
	CONSTRAINT "user_cards_updated_at_safe_integer_check" CHECK ("user_cards"."updated_at" >= 0 and "user_cards"."updated_at" <= 9007199254740991 and "user_cards"."updated_at" = trunc("user_cards"."updated_at"))
);
--> statement-breakpoint
CREATE TABLE "user_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" double precision NOT NULL,
	"updated_at" double precision NOT NULL,
	CONSTRAINT "user_decks_created_at_safe_integer_check" CHECK ("user_decks"."created_at" >= 0 and "user_decks"."created_at" <= 9007199254740991 and "user_decks"."created_at" = trunc("user_decks"."created_at")),
	CONSTRAINT "user_decks_updated_at_safe_integer_check" CHECK ("user_decks"."updated_at" >= 0 and "user_decks"."updated_at" <= 9007199254740991 and "user_decks"."updated_at" = trunc("user_decks"."updated_at"))
);
--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_decks" ADD CONSTRAINT "user_decks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "remelon_revision_checkpoints_observed_at_idx" ON "remelon_revision_checkpoints" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "review_events_user_rev_idx" ON "review_events" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "review_events_user_card_idx" ON "review_events" USING btree ("user_id","user_card_id");--> statement-breakpoint
CREATE INDEX "user_cards_user_rev_idx" ON "user_cards" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_cards_user_updated_idx" ON "user_cards" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "user_cards_user_due_idx" ON "user_cards" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "user_decks_user_rev_idx" ON "user_decks" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_decks_user_updated_idx" ON "user_decks" USING btree ("user_id","updated_at");