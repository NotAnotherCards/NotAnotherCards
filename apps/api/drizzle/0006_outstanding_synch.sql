CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"rev" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"username" text,
	"bio" text,
	"avatar_file_id" uuid,
	"native_language_id" uuid,
	"target_language_id" uuid,
	"created_at" double precision NOT NULL,
	"updated_at" double precision NOT NULL,
	CONSTRAINT "user_profiles_created_at_safe_integer_check" CHECK ("user_profiles"."created_at" >= 0 and "user_profiles"."created_at" <= 9007199254740991 and "user_profiles"."created_at" = trunc("user_profiles"."created_at")),
	CONSTRAINT "user_profiles_updated_at_safe_integer_check" CHECK ("user_profiles"."updated_at" >= 0 and "user_profiles"."updated_at" <= 9007199254740991 and "user_profiles"."updated_at" = trunc("user_profiles"."updated_at"))
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_username_unique";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "user_profiles" (
	"user_id", "rev", "username", "created_at", "updated_at"
)
SELECT
	"id",
	nextval('remelon_rev'),
	"username",
	extract(epoch from "created_at") * 1000,
	extract(epoch from "updated_at") * 1000
FROM "user";--> statement-breakpoint
CREATE INDEX "user_profiles_user_rev_idx" ON "user_profiles" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_profiles_user_updated_idx" ON "user_profiles" USING btree ("user_id","updated_at");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "username";
