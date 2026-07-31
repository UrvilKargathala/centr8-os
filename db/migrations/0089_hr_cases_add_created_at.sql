-- 0087 restructured hr_cases with category_id/subject/priority/
-- is_confidential/resolved_at/closed_at but missed created_at, which
-- db/schema.ts has always declared on hrCases — the original table
-- (0037) never had it either. Fixing forward rather than amending 0087.
ALTER TABLE "hr_cases" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
