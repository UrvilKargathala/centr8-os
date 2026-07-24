CREATE TABLE "user_preferences" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"full_name" text,
	"job_title" text,
	"department" text,
	"phone" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'UTC',
	"language" text DEFAULT 'en',
	"theme" text DEFAULT 'system' NOT NULL,
	"density" text DEFAULT 'comfortable' NOT NULL,
	"default_landing_page" text DEFAULT 'dashboard' NOT NULL,
	"time_format" text DEFAULT '24h' NOT NULL,
	"date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL,
	"week_starts_on" text DEFAULT 'monday' NOT NULL,
	"notify_email" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notify_inapp" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notify_digest" text DEFAULT 'realtime' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "user_preferences_owner" ON "user_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());