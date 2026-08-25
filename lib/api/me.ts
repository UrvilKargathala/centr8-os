import { and, desc, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { auditLog, userPreferences } from "@/db/schema";

// Loads (or lazily inserts) the caller's user_preferences row for the given
// org. Shared by app/api/me/profile/route.ts (GET) and
// app/(app)/settings/profile/page.tsx (server-rendered initial load).
export async function loadOrInitPreferences(db: OrgScopedDb, userId: string, orgId: string) {
  const existing = await db
    .select()
    .from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.orgId, orgId)))
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db.insert(userPreferences).values({ userId, orgId }).returning();
  return row;
}

// Takes the already-resolved Supabase auth user (server or client caller
// already has it) plus a preferences row, and assembles the same shape
// GET /api/me/profile returns.
export function assembleProfile(user: { email?: string | null; email_confirmed_at?: string | null; app_metadata?: Record<string, unknown> } | null, prefs: unknown) {
  const providers: string[] = (user?.app_metadata?.providers as string[] | undefined) ?? [];
  const isSsoManaged = providers.length > 0 && providers.every((p) => p !== "email");
  return {
    email: user?.email ?? null,
    emailVerified: !!user?.email_confirmed_at,
    providers,
    isSsoManaged,
    preferences: prefs,
  };
}

// Shared by app/api/me/security-log/route.ts and
// app/(app)/settings/profile/page.tsx (server-rendered initial load).
export function listMySecurityLog(db: OrgScopedDb, userId: string) {
  return db.select().from(auditLog).where(eq(auditLog.actorUserId, userId)).orderBy(desc(auditLog.createdAt)).limit(10);
}
