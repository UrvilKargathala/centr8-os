CREATE TYPE "public"."account_type" AS ENUM('prospect', 'customer', 'partner', 'vendor', 'other');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'inactive', 'churned');--> statement-breakpoint

ALTER TABLE "accounts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "country" text DEFAULT 'India';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "type" "account_type" DEFAULT 'prospect' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "annual_revenue" numeric(15,2);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "employee_count_range" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "parent_account_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "created_by" uuid;--> statement-breakpoint

ALTER TABLE "contacts" ADD COLUMN "mobile" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "is_primary_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "is_decision_maker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "mailing_address" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "country" text DEFAULT 'India';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "converted_from_lead_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "created_by" uuid;--> statement-breakpoint

ALTER TABLE "leads" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source_detail" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score_reasoning" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "source" SET DEFAULT 'manual';--> statement-breakpoint

ALTER TABLE "activities" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "activity_date" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "performed_by" uuid;--> statement-breakpoint

ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activities" FORCE ROW LEVEL SECURITY;
