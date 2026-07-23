// Phase 7 (Communication pillar) — connector framework helpers shared by
// the integrations list route and each provider's send route.
import type { integrations } from "@/db/schema";

type IntegrationRow = typeof integrations.$inferSelect;

// config holds OAuth tokens (Slack's access_token, etc.) — never sent to
// the client. Only non-secret display fields survive here.
export function toPublicIntegration(row: IntegrationRow) {
  const config = row.config as Record<string, unknown>;
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    connectedAt: row.connectedAt,
    connectedByUserId: row.connectedByUserId,
    // display-only metadata that's safe to show (e.g. Slack's team name) —
    // never access_token/refresh_token.
    teamName: typeof config.team_name === "string" ? config.team_name : null,
  };
}
