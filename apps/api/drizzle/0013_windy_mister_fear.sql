CREATE TABLE "published_decks" (
	"deck_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"note_type" text NOT NULL,
	"native_language_id" text,
	"target_language_id" text,
	"card_count" integer NOT NULL,
	"content" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
