// Phase 7 (Communication pillar) — connector framework helpers shared by
// the integrations list route and each provider's send route.
import type { integrations } from "@/db/schema";

type IntegrationRow = typeof integrations.$inferSelect;

// config holds OAuth tokens (access_token/refresh_token, etc.) — never sent
// to the client. Only non-secret display fields survive here.
export function toPublicIntegration(row: IntegrationRow) {
  const config = row.config as Record<string, unknown>;
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    connectedAt: row.connectedAt,
    connectedByUserId: row.connectedByUserId,
    // Display-only: Slack's workspace/team name, or Gmail's connected email
    // address — whichever the provider's callback stored. Never a token.
    accountLabel: typeof config.team_name === "string" ? config.team_name : null,
  };
}
