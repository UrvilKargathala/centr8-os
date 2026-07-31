ALTER TYPE "public"."deal_stage" ADD VALUE 'discovery' BEFORE 'proposal';--> statement-breakpoint
ALTER TYPE "public"."deal_stage" ADD VALUE 'contract_sent' BEFORE 'won';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'close';
