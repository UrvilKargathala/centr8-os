// Phase 7 (Communication pillar) — connector framework helpers shared by
// the integrations list route and each provider's send route.
import { eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { requirePermission } from "./permissions";

type IntegrationRow = typeof integrations.$inferSelect;

// Shared by app/api/integrations/route.ts (GET) and
// app/(app)/admin/integrations/page.tsx (server-rendered initial load).
export async function listIntegrations(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "integration", "read");
  const rows = await db.select().from(integrations).where(eq(integrations.orgId, orgId));
  return rows.map(toPublicIntegration);
}

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
    // ClickUp only — which list the Tasks tab reads from, or null when
    // falling back to findFirstListId's auto-pick. Not secret, same class
    // of display data as accountLabel.
    selectedListId: typeof config.selected_list_id === "string" ? config.selected_list_id : null,
    selectedListName: typeof config.selected_list_name === "string" ? config.selected_list_name : null,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
  };
}
