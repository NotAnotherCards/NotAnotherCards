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
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_badges_user_rev_idx" ON "user_badges" USING btree ("user_id","rev");--> statement-breakpoint
CREATE INDEX "user_badges_user_updated_idx" ON "user_badges" USING btree ("user_id","updated_at");