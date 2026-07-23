import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { toPublicIntegration } from "@/lib/api/integrations";

type Params = { params: Promise<{ id: string }> };

// Disconnect: clears the stored credentials, doesn't just flip a flag —
// a revoked/deleted OAuth token shouldn't linger in the row.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: integrations.orgId }).from(integrations).where(eq(integrations.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "integration", "configure");

      const [updated] = await db
        .update(integrations)
        .set({ status: "disconnected", config: {}, connectedByUserId: null, connectedAt: null })
        .where(eq(integrations.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Integration not found");

    return NextResponse.json({ data: toPublicIntegration(row) });
  } catch (err) {
    return handleApiError(err);
  }
}
