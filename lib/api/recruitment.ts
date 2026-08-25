// HR Batch 3 — Recruitment/Hiring. Admin/HR + hiring-manager access, no
// candidate-facing portal (internal staff data entry only — CLAUDE.md
// §11a). manage_candidates/schedule_interview are grid-granted to
// owner/admin/member (the "hiring manager can be any role" tier);
// submit_feedback additionally requires being the specific assigned
// interviewer on that interview, not just holding the grant.
import { eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees, interviewSchedules, jobPostings } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission } from "./permissions";

export function requireRecruitmentViewAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "recruitment", "read");
}
export function requireCreateJobAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "recruitment", "create_job");
}
export function requireManageCandidatesAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "recruitment", "manage_candidates");
}
export function requireScheduleInterviewAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "recruitment", "schedule_interview");
}

// The grant (recruitment:submit_feedback) plus a specific-assignment
// check — only the interviewer named on this exact interview_schedules
// row can write feedback/recommendation for it, verified against the
// caller's own linked employees row.
export async function requireInterviewFeedbackAccess(db: OrgScopedDb, userId: string, orgId: string, interviewerId: string | null): Promise<void> {
  await requirePermission(db, userId, orgId, "recruitment", "submit_feedback");
  if (!interviewerId) throw new ApiError(403, "This interview has no assigned interviewer");
  const [own] = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, userId));
  if (!own || own.id !== interviewerId) {
    throw new ApiError(403, "You can only submit feedback for interviews assigned to you");
  }
}

// Shared by app/api/recruitment/jobs/route.ts (unfiltered case) and
// app/(app)/hr/recruitment/page.tsx (server-rendered "Job Postings" tab,
// the default).
export async function listAllJobPostings(db: OrgScopedDb, userId: string, orgId: string) {
  await requireRecruitmentViewAccess(db, userId, orgId);
  return db.select().from(jobPostings).where(eq(jobPostings.orgId, orgId));
}

export type InterviewSchedule = typeof interviewSchedules.$inferSelect;
