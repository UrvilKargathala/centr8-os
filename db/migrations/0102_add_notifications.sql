-- In-app Notifications feed (bell icon + /notifications page). Hand-written,
-- not drizzle-kit-generated, same reason as 0099's header comment: the local
-- drizzle snapshot chain hasn't caught up to years of hand-applied
-- migrations, so a `db:generate` diff pulls in unrelated drift. Scoped to
-- exactly the one new table this feature needs.

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"icon" text,
	"link_type" text,
	"link_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint

CREATE POLICY "notifications_select" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (org_id in (select * from auth.user_org_ids()) and user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "notifications_insert" ON "notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "notifications_update" ON "notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (org_id in (select * from auth.user_org_ids()) and user_id = auth.uid()) WITH CHECK (org_id in (select * from auth.user_org_ids()) and user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "notifications_delete" ON "notifications" AS PERMISSIVE FOR DELETE TO "authenticated" USING (org_id in (select * from auth.user_org_ids()) and user_id = auth.uid());
