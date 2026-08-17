-- ClickUp integration: extends the existing integrations table (0052)
-- rather than creating a parallel table — same connector framework Slack
-- and Gmail already use, just a Personal API Token instead of an OAuth
-- redirect, stored in the same plaintext `config` jsonb column (this repo
-- has no reversible-encryption helper; secrets are protected by RLS +
-- toPublicIntegration() stripping them before any client response, the
-- same pattern Slack/Gmail's tokens already rely on).
--
-- ADD VALUE must be its own statement, not used later in this same
-- migration/transaction (same rule as every prior enum-value + usage pair
-- in this repo, e.g. 0052/0054) — this migration only adds the value and
-- two new columns, it never references 'clickup' itself.
ALTER TYPE "public"."integration_provider" ADD VALUE 'clickup';--> statement-breakpoint

ALTER TABLE "integrations" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "last_error" text;
