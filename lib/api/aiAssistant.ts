// Core mutation logic for the AI Assistant build-out (Sprint Plans,
// Documents) — extracted out of the route handlers so it's directly
// testable, same "route is a thin HTTP wrapper around a lib function"
// pattern lib/api/crm.ts established for changeDealStage/convertLead.
import { eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { auditLog, sprintPlanProposals, sprints, tasks, generatedDocuments } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission } from "./permissions";

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
