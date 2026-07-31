-- AI Assistant build-out: Sprint Plans, Ask AI, Documents (Recommendations
-- needs no schema — computed live). Hand-written rather than
-- drizzle-kit-generated: a `db:generate` diff against the current schema.ts
-- pulls in a large amount of pre-existing drift from earlier hand-applied
-- migrations (0087/0091/0094/0097 etc. already ran DROP TABLE forecasts /
-- training_completions and dozens of column adds that the local drizzle
-- snapshot never caught up to) — replaying that as one blob here would be
-- unsafe. This migration is scoped to exactly the 4 new tables + 2 new
-- resource_type values this batch needs.

CREATE TYPE "public"."sprint_plan_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('prd', 'sop', 'meeting_summary', 'release_notes', 'bug_report', 'test_cases', 'client_update', 'executive_summary');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'reviewed', 'finalized');--> statement-breakpoint

ALTER TYPE "public"."resource_type" ADD VALUE 'sprint_plan';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'document';--> statement-breakpoint

CREATE TABLE "sprint_plan_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"sprint_name" text NOT NULL,
	"proposed_start_date" date,
	"proposed_end_date" date,
	"proposed_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity_analysis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text,
	"status" "sprint_plan_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint_plan_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE "generated_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"doc_type" "document_type" NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"context_source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"finalized_by" uuid,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "generated_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "sprint_plan_proposals" ADD CONSTRAINT "sprint_plan_proposals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_plan_proposals" ADD CONSTRAINT "sprint_plan_proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE POLICY "sprint_plan_proposals_isolation" ON "sprint_plan_proposals" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "ai_conversations_isolation" ON "ai_conversations" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids()) and user_id = auth.uid()) WITH CHECK (org_id in (select * from auth.user_org_ids()) and user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "ai_messages_isolation" ON "ai_messages" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids()) and exists (select 1 from ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = auth.uid())) WITH CHECK (org_id in (select * from auth.user_org_ids()) and exists (select 1 from ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "generated_documents_isolation" ON "generated_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));
