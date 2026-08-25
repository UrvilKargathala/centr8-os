// Core mutation logic for the AI Assistant build-out (Sprint Plans,
// Documents) — extracted out of the route handlers so it's directly
// testable, same "route is a thin HTTP wrapper around a lib function"
// pattern lib/api/crm.ts established for changeDealStage/convertLead.
import { desc, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { aiConversations, auditLog, sprintPlanProposals, sprints, tasks, generatedDocuments, projects } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission } from "./permissions";

// Shared by app/api/ai/documents/route.ts (unfiltered case) and
// app/(app)/ai/documents/page.tsx (server-rendered initial load).
export async function listAllDocuments(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "document", "read");
  return db.select().from(generatedDocuments).where(eq(generatedDocuments.orgId, orgId)).orderBy(desc(generatedDocuments.createdAt));
}

// Shared by app/api/ai/conversations/route.ts and app/(app)/ai/ask/page.tsx
// (server-rendered sidebar list) — no permission gate, RLS alone scopes
// results to the caller's own conversations.
export function listMyConversations(db: OrgScopedDb, orgId: string) {
  return db.select().from(aiConversations).where(eq(aiConversations.orgId, orgId)).orderBy(desc(aiConversations.updatedAt));
}

// Shared by app/api/ai/sprint-plans/route.ts (unfiltered case) and
// app/(app)/ai/sprint-plans/page.tsx (server-rendered initial load).
export async function listAllSprintPlans(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "sprint_plan", "read");
  return db.select().from(sprintPlanProposals).where(eq(sprintPlanProposals.orgId, orgId)).orderBy(desc(sprintPlanProposals.createdAt));
}

type ProposedTask = { title: string; assignee_name: string; estimate: number; priority: string };

export async function approveSprintPlan(db: OrgScopedDb, userId: string, proposalId: string) {
  const [proposal] = await db.select().from(sprintPlanProposals).where(eq(sprintPlanProposals.id, proposalId));
  if (!proposal) throw new ApiError(404, "Sprint plan proposal not found");
  await requirePermission(db, userId, proposal.orgId, "sprint_plan", "approve");
  if (proposal.status !== "pending") throw new ApiError(400, "Only a pending proposal can be approved");

  const [sprint] = await db
    .insert(sprints)
    .values({
      orgId: proposal.orgId,
      projectId: proposal.projectId,
      name: proposal.sprintName,
      startDate: proposal.proposedStartDate,
      endDate: proposal.proposedEndDate,
      status: "planned",
    })
    .returning();

  const proposedTasks = proposal.proposedTasks as ProposedTask[];
  const taskRows = proposedTasks.length
    ? await db
        .insert(tasks)
        .values(
          proposedTasks.map((t) => ({
            orgId: proposal.orgId,
            projectId: proposal.projectId,
            sprintId: sprint.id,
            title: t.title,
            priority: (["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium") as
              | "low"
              | "medium"
              | "high"
              | "urgent",
            estimate: t.estimate,
          })),
        )
        .returning()
    : [];

  const [updated] = await db
    .update(sprintPlanProposals)
    .set({ status: "approved", decidedBy: userId, decidedAt: new Date() })
    .where(eq(sprintPlanProposals.id, proposalId))
    .returning();

  await db.insert(auditLog).values({
    orgId: proposal.orgId,
    actorUserId: userId,
    actorType: "human",
    action: "sprint_plan_approved",
    targetType: "sprint_plan_proposal",
    targetId: proposalId,
    metadata: { sprintId: sprint.id, taskCount: taskRows.length },
  });

  return { proposal: updated, sprint, tasks: taskRows };
}

export async function rejectSprintPlan(db: OrgScopedDb, userId: string, proposalId: string, rejectionReason: string) {
  const [proposal] = await db.select().from(sprintPlanProposals).where(eq(sprintPlanProposals.id, proposalId));
  if (!proposal) throw new ApiError(404, "Sprint plan proposal not found");
  await requirePermission(db, userId, proposal.orgId, "sprint_plan", "approve");
  if (proposal.status !== "pending") throw new ApiError(400, "Only a pending proposal can be rejected");

  const [updated] = await db
    .update(sprintPlanProposals)
    .set({ status: "rejected", decidedBy: userId, decidedAt: new Date(), rejectionReason })
    .where(eq(sprintPlanProposals.id, proposalId))
    .returning();

  await db.insert(auditLog).values({
    orgId: proposal.orgId,
    actorUserId: userId,
    actorType: "human",
    action: "sprint_plan_rejected",
    targetType: "sprint_plan_proposal",
    targetId: proposalId,
    metadata: { rejectionReason },
  });

  return updated;
}

export async function reviewDocument(db: OrgScopedDb, userId: string, docId: string, revert: boolean) {
  const [row] = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, docId));
  if (!row) throw new ApiError(404, "Document not found");
  await requirePermission(db, userId, row.orgId, "document", "update");

  if (revert) {
    if (row.status !== "reviewed") throw new ApiError(400, "Only a reviewed document can be reverted to draft");
    const [result] = await db
      .update(generatedDocuments)
      .set({ status: "draft", reviewedBy: null, reviewedAt: null })
      .where(eq(generatedDocuments.id, docId))
      .returning();
    return result;
  }

  if (row.status !== "draft") throw new ApiError(400, "Only a draft document can be marked reviewed");
  const [result] = await db
    .update(generatedDocuments)
    .set({ status: "reviewed", reviewedBy: userId, reviewedAt: new Date() })
    .where(eq(generatedDocuments.id, docId))
    .returning();
  return result;
}

export async function finalizeDocument(db: OrgScopedDb, userId: string, docId: string) {
  const [row] = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, docId));
  if (!row) throw new ApiError(404, "Document not found");
  await requirePermission(db, userId, row.orgId, "document", "finalize");
  if (row.status !== "reviewed") throw new ApiError(400, "Only a reviewed document can be finalized");

  const [result] = await db
    .update(generatedDocuments)
    .set({ status: "finalized", finalizedBy: userId, finalizedAt: new Date() })
    .where(eq(generatedDocuments.id, docId))
    .returning();
  return result;
}

// Shared by app/api/ai/documents/[id]/route.ts (GET) and
// app/(app)/ai/documents/[id]/page.tsx (server-rendered initial load) —
// mirrors the page's own load(), including the linked-project lookup.
export async function getDocumentDetail(db: OrgScopedDb, userId: string, id: string) {
  const [doc] = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, id));
  if (!doc) return null;
  await requirePermission(db, userId, doc.orgId, "document", "read");

  const projectId = (doc.contextSource as { projectId?: string } | null)?.projectId;
  const project = projectId ? (await db.select().from(projects).where(eq(projects.id, projectId)))[0] ?? null : null;

  return { doc, project };
}

export async function editDocument(db: OrgScopedDb, userId: string, docId: string, patch: { title?: string; content?: string }) {
  const [row] = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, docId));
  if (!row) throw new ApiError(404, "Document not found");
  await requirePermission(db, userId, row.orgId, "document", "create");
  if (row.status !== "draft") throw new ApiError(400, "Only a draft document can be edited");

  const [result] = await db
    .update(generatedDocuments)
    .set({ title: patch.title ?? row.title, content: patch.content ?? row.content })
    .where(eq(generatedDocuments.id, docId))
    .returning();
  return result;
}
