CREATE TABLE "user_note_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"note_id" text NOT NULL,
	"deck_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" double precision NOT NULL,
	"updated_at" double precision NOT NULL,
	CONSTRAINT "user_note_decks_created_at_safe_integer_check" CHECK ("user_note_decks"."created_at" >= 0 and "user_note_decks"."created_at" <= 9007199254740991 and "user_note_decks"."created_at" = trunc("user_note_decks"."created_at")),
	CONSTRAINT "user_note_decks_updated_at_safe_integer_check" CHECK ("user_note_decks"."updated_at" >= 0 and "user_note_decks"."updated_at" <= 9007199254740991 and "user_note_decks"."updated_at" = trunc("user_note_decks"."updated_at"))
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"note_type" text NOT NULL,
	"fields_version" integer NOT NULL,
	"fields_json" text NOT NULL,
	"additional_content" text,
	"created_at" double precision NOT NULL,
	"updated_at" double precision NOT NULL,
	CONSTRAINT "user_notes_created_at_safe_integer_check" CHECK ("user_notes"."created_at" >= 0 and "user_notes"."created_at" <= 9007199254740991 and "user_notes"."created_at" = trunc("user_notes"."created_at")),
	CONSTRAINT "user_notes_updated_at_safe_integer_check" CHECK ("user_notes"."updated_at" >= 0 and "user_notes"."updated_at" <= 9007199254740991 and "user_notes"."updated_at" = trunc("user_notes"."updated_at"))
);
--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "note_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "template_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_note_decks" ADD CONSTRAINT "user_note_decks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_note_decks_user_rev_idx" ON "user_note_decks" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_note_decks_user_updated_idx" ON "user_note_decks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "user_note_decks_note_idx" ON "user_note_decks" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "user_note_decks_deck_idx" ON "user_note_decks" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "user_notes_user_rev_idx" ON "user_notes" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_notes_user_updated_idx" ON "user_notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "user_cards_note_idx" ON "user_cards" USING btree ("note_id");--> statement-breakpoint
ALTER TABLE "user_cards" DROP COLUMN "deck_id";