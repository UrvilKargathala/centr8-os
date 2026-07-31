# CLAUDE.md — Centr8 OS

Locked architecture and requirement reference for Claude Code. Read this before starting any phase. Do not deviate from the stack or patterns below without flagging it back to Urvil first.

---

## 1. Product Summary

Centr8 OS is an AI-native "operating system for work." An autonomous AI Project Manager plans, monitors, and executes operational project work. Humans set direction and approve consequential AI actions via a tiered autonomy model. Source docs: Centr8 OS BRD v1.0, Centr8 OS PRD v1.0, Centr8 OS Feature Tracker (July 2026).

---

## 2. Locked Tech Stack (Free Tier Only)

| Layer | Tool | Notes |
|---|---|---|
| Frontend / API routes | Next.js (Vercel) | Standard CRUD, auth pages, dashboards, client portal |
| AI / Agent orchestration workers | Node or Python long-running workers (Railway) | Agents don't fit serverless timeouts — planning/monitoring loops run here |
| Database | Neon Postgres | Single source of truth for both Next.js and Railway workers |
| Auth / RBAC | Supabase Auth (free tier) | RLS for multi-tenant isolation |
| Job queue | Postgres-backed (`SELECT ... FOR UPDATE SKIP LOCKED`) | Do NOT use Upstash — already consumed by SiteScore |
| LLM | Google Gemini (free tier) | All agent reasoning (Planner, Monitor, Analyst, Writer, Communicator) |
| RAG / embeddings | Postgres + pgvector (Neon extension, free) | No external vector DB |
| Email / transactional | Resend | Client comms, notifications |
| Analytics | PostHog | Feature usage, AI action logs |
| PDF / doc generation | react-pdf (client-side) | Generative docs (PRDs, SOPs, reports) render client-side |
| Realtime / notifications | Postgres LISTEN/NOTIFY or polling | No paid realtime service |

**Hard constraint:** No paid infra (Temporal, ClickHouse, dedicated vector DB, paid Redis) unless explicitly revisited at a phase gate, same pattern as Recur8.

---

## 3. Multi-Tenant & Data Isolation

- Every table scoped by `org_id`. RLS policies enforced at Postgres level via Supabase Auth, not just app-layer checks.
- AI context/memory (workspace memory, RAG index) is partitioned by `org_id` — no cross-tenant leakage, including in embeddings/vector search.
- Use direct (non-pooled) Neon connection string for all migrations; pooled connection for runtime queries only.

---

## 4. AI Autonomy Tiers (Governance Model — PRD Section 5)

| Tier | Behavior | Example |
|---|---|---|
| Tier 0 — Suggest Only | AI proposes, human must trigger | Draft client comms |
| Tier 1 — Approve to Act | AI queues, human approves/rejects in a window | Sprint plan activation, reassignment |
| Tier 2 — Act with Notification | AI executes low-risk reversible actions, notifies after | Status updates, standup posts |
| Tier 3 — Full Autonomy (opt-in, scoped) | AI executes without per-instance approval, within policy | Recurring task generation, routine reports |

**Default for every new AI action type: Tier 0.** Escalating to Tier 1+ requires an explicit config flag per org, per action type. Never default an action higher than Tier 0 without Urvil confirming it in the phase review.

---

## 5. Composable Agent Pattern

Do not build one monolithic "do everything" AI call. Five specialized agents, each a distinct prompt/service, coordinated by a lightweight orchestration layer (a Railway worker, not a separate paid orchestration product):

- **Planner** — NL → structured project/sprint plans
- **Monitor** — health signals, risk detection, delivery prediction
- **Analyst** — comparative analysis, executive insights
- **Writer** — generative docs (PRDs, SOPs, release notes, reports)
- **Communicator** — client updates, standup summaries

---

## 6. Requirement ID Convention

Requirements referenced as `FR-x.x` (functional), matching the Feature Tracker. 63 total FRs across 13 categories. Priority: 46 Must, 16 Should, 1 Could. Full detail lives in `Centr8_OS_Feature_Tracker.xlsx` — this file summarizes scope only; the tracker is the source of truth for status/owner.

Category → ID prefix mapping:

| Category | Prefix range (approx) |
|---|---|
| Organizations, Workspaces & Access | FR-1.x |
| Work Hierarchy (Goals→Tasks) | FR-2.x |
| Resource Planning & Budgeting | FR-3.x |
| Client Portals | FR-4.x |
| Documentation & Knowledge Mgmt | FR-5.x |
| Automation, API, Webhooks, Integrations | FR-6.x |
| AI: NL Project Creation | FR-7.x |
| AI: Monitoring, Prediction, Risk | FR-8.x |
| AI: Sprint Planning & Workflow Automation | FR-9.x |
| AI: Generative Docs & Comms | FR-10.x |
| AI: Workspace Memory & RAG Q&A | FR-11.x |
| AI Assistant Interfaces | FR-12.x |
| Executive Insight & Decision Support | FR-13.x |

(Verify exact IDs against the tracker before implementing — this table is a navigation aid, not the authoritative list.)

---

## 7. Acceptance Criteria Pattern

Every feature implemented must satisfy, at minimum:
1. Scoped correctly to `org_id` (no cross-tenant data visible)
2. If it's an AI action: correct autonomy tier enforced, and an audit log entry written
3. If it's AI-generated content: a "provisional/AI-generated" banner shown until a human confirms/accepts it (same UX pattern as LucidCarat)
4. No paid service introduced without a flagged deviation

**Implementation note:** AI touchpoints must use the shared `AiButton` + `AiSuggestionCard` (+ `useAiCall`) from `components/ui/AiTouchpoint.tsx` — do not re-implement the banner + Accept/Reject/Edit pattern inline per screen. See `components/NewProjectWizard.tsx` and the HR Employee Detail page's AI Insights tab (`app/(app)/hr/employees/[id]/page.tsx`) as canonical examples.

---

## 8. Out of Scope (V1) — Do Not Build

- Native time-tracking hardware
- Payroll / full HRIS
- Full accounting/ERP (integration only, not a rebuild)
- On-prem / air-gapped deployment
- Native mobile apps

---

## 9. Open Questions (Not Yet Decided — Flag if Blocking)

- Final AI usage-based pricing model (per-seat + consumption vs. tiered flat)
- Which LLM provider/routing strategy long-term (currently Gemini free tier for build phase only — production model choice is unresolved)
- Whether native mobile gets pulled into Release 2
- Minimum viable native integrations for early design partners
- Data residency requirements for first regulated customer

---

## 10. Reusable Cross-Project Patterns (Carry Forward)

- Provisional-results banner (LucidCarat) — applies to all AI-generated output here, not just docs
- Postgres-backed job queue (RAG Scanner) — reused directly for agent task queueing
- Separate-repo admin panel pattern (ExportInvoice Pro precedent) — `centr8os-admin` as its own repo if/when an internal admin console is needed
- react-pdf async/sync boundary (ExportInvoice Pro) — applies to generative doc export (PRDs, SOPs, release notes)

---

## 11a. Scope Expansion — HR, CRM, and Communication Pillars (Added Post-V1)

Centr8 OS's scope has expanded beyond the original BRD/PRD's "AI-native project management" positioning. The product is now a multi-pillar business OS with five pillars:

1. **Project Management** (original scope — Goals→Portfolios→Projects→Milestones→Sprints→Tasks)
2. **HR Management** (new — modeled on Zoho People's feature set)
3. **CRM** (new — modeled on Zoho CRM's standard modules)
4. **Communication** (new — Messenger, Mail, Calls, Video Conferencing)
5. **AI Assistant** (cuts across all four pillars above, not a separate product)

This is a deliberate, confirmed scope change from the original BRD (which listed HR/payroll and full CRM as out-of-scope integrations-only). Anyone picking up this codebase later should treat this section as authoritative over the original BRD Section 4.2 where they conflict.

### Build vs. Integrate Decision

- **HR Management** and **CRM**: build natively, following the same schema/RLS/RBAC patterns already established for the Project Management pillar (org_id-scoped tables, `can()` permission gating, DESIGN_SYSTEM.md tokens).
- **Communication** (Messenger, Mail, Calls, Video Conferencing): integrate via connectors/plugins, do NOT rebuild natively. These are individually massive products (Slack, Gmail, Zoom-scale) and rebuilding them natively is out of scope even long-term. Use the plugin/integration architecture from Prompt 3.4 as the mechanism — Centr8 OS surfaces these tools inside its UI via connectors, it does not replace them.

### Sidebar / Navigation Structure (Locked)

```
PROJECT MANAGEMENT
  Dashboard, Projects, Sprints, Tasks

HR MANAGEMENT
  Employee Directory, Onboarding, Attendance & Time Tracking,
  Leave Management, Payroll & Compensation, Performance Reviews & OKRs,
  Recruitment / Hiring, HR Cases & Helpdesk, Learning & Training (LMS),
  Employee Engagement / Surveys

COMMUNICATION (integrated, not native)
  Messenger, Mail, Calls, Video Conferencing

CRM
  Leads, Contacts, Accounts, Deals / Pipeline, Activities,
  Sales Forecasts, Campaigns

RESOURCES
  Capacity Planning, Budgets

AI ASSISTANT (dedicated cross-module screens)
  AI Draft, Health Monitoring, Sprint Plans, Ask AI, Documents, Recommendations

INSIGHTS
  Executive Dashboard

ADMINISTRATION
  Members & Roles, SSO & Security, Automations, API Keys, Audit Log, Integrations
```

### AI Placement Rule

AI is not siloed to the AI Assistant section alone. The five composable agents (Planner, Monitor, Analyst, Writer, Communicator — CLAUDE.md §5) are reusable across all pillars:

- **HR Management**: AI-drafted job postings (Writer), AI-summarized performance reviews (Analyst), AI-flagged attendance anomalies (Monitor)
- **CRM**: AI lead scoring (Analyst), AI-drafted follow-up emails (Writer), AI-generated deal-risk summaries (Monitor)
- **Project Management**: already implemented (Health Monitoring, AI Draft)

Every contextual AI touchpoint inside a module (not a dedicated AI Assistant screen) must still follow the provisional-results banner pattern and correct autonomy tier per CLAUDE.md §4 — embedding AI into more modules does not relax the approval-gating rules.

**CRM (Batch 1 — Leads/Contacts/Accounts) is fully built.** A real CRM implementation predates this batch (accounts/contacts/leads/deals/activities/campaigns/forecasts tables, permissions, API routes, admin-console-style UI — apparently from earlier "Prompt 6.1-6.3" work never documented here). CRM Batch 1 extended leads/contacts/accounts/activities substantially — richer field sets (leads: score+reasoning, source/source_detail, campaign attribution; accounts: full address+revenue+type/status; contacts: decision-maker/primary flags, last-contacted tracking), lead conversion as a proper transactional operation (`convertLead()`, `lib/api/crm.ts` — creates account+contact, updates the lead, logs a conversion activity, all inside `withOrgContext`'s single transaction; a 400 on re-converting an already-converted or lost lead, never a silent no-op), and a shared activity timeline (`activities` table, polymorphic `relatedType`/`relatedId` across lead/contact/account) — and left deals/campaigns/forecasts untouched, out of scope for CRM Batch 2/3. Resource types: `lead`/`contact`/`account`/`activity`. Tiering: owner/admin/member get full create/read/update/delete on all three plus activity create/read (the existing flat grid, unchanged); `lead:convert` is additionally granted to member (the "Editor" tier — can progress and convert leads, not delete or reassign them); `lead:assign`/`account:assign`/`contact:assign` are owner/admin only (migration `0092_seed_crm_batch1_permissions.sql`). Seven AI touchpoints: score_lead, enrich_lead, summarize_account, summarize_contact (Analyst), suggest_lead_action, suggest_account_action (Planner), draft_crm_email (Writer) — all through the shared `AiButton`+`AiSuggestionCard`/`useAiCall` pattern, none auto-submitting. UI: `/crm` (dashboard — real KPIs from `/api/crm/stats`, recent leads, recent activities, a Pipeline Summary placeholder), `/crm/leads` (table + Kanban board with HTML5 drag between new/contacted/qualified/unqualified, lead detail panel with the three AI touchpoints and a Convert-to-Account confirmation flow), `/crm/accounts` (list) + `/crm/accounts/[id]` (tabs: Overview/Contacts/Activities/Deals-placeholder/AI Insights), `/crm/contacts` (list + detail panel, including the draft-follow-up-email touchpoint that copies to clipboard rather than sending), `/crm/activities` (read-only cross-entity log). Deals/Campaigns/Forecasts already existed from the earlier undocumented work and remain out of scope for this batch — their API routes (`/api/deals`, `/api/campaigns`, `/api/forecasts`) still function untouched, but their pages (`/crm/deals`, `/crm/campaigns`, `/crm/forecasts`) are now simple "Coming in CRM Batch 2/3" placeholders, since the sidebar no longer routes users to them for interaction. Planned: CRM Batch 2 (Deals/Pipeline) and CRM Batch 3 (Forecasts/Campaigns) will build real UI against those existing APIs.

**CRM Batch 2 (Deals/Pipeline) is now fully built.** The `deals` table was extended in place with the full pipeline field set (7-stage `deal_stage` enum: prospecting→discovery→proposal→negotiation→contract_sent→won/lost — won/lost are terminal outcomes, not Kanban columns), and a new `deal_stage_history` table tracks every transition (from_stage/to_stage/changed_by/duration_in_previous_stage_minutes), written transactionally alongside a `status_change` activity by `changeDealStage()` (`lib/api/crm.ts`) — never a plain field edit. `deal:close` is a distinct permission from `deal:update`, same reasoning as `lead:convert`: closing a deal (won/lost, sets actualCloseDate/lostReason/wonNotes via `closeDeal()`, which rejects a lost close with no `lost_reason` as a 400) has financial/reporting implications, so it isn't implied by ordinary field-edit access — `deal:assign` is likewise separate from `deal:update`. Tiering: owner/admin get all deal permissions including close/assign/delete; member ("Editor" tier) gets create/read/update/close but not delete/assign; viewer is read-only. Lead conversion can now optionally create a deal in the same transaction — `convertLead()`'s `createDeal` option (default `true`) creates account+contact+deal atomically and returns `{lead, account, contact, deal}`; the lead-conversion modal on `/crm/leads` now has an "Also create a deal" toggle (default on) wired to it. Four new AI touchpoints: assess_deal_risk (Monitor), draft_deal_proposal (Writer), suggest_deal_next_step (Planner), predict_deal_close (Analyst) — same `AiButton`+`AiSuggestionCard`/`useAiCall` pattern, none auto-submitting. UI: `/crm/deals` (KPI cards from `/api/crm/deals/pipeline-stats`; Kanban default view with optimistic drag-and-drop between the 5 open stages and revert-on-failure; Table view; Forecast view — a stacked bar by stage plus a plain-div monthly bar list, no charting library) and `/crm/deals/[id]` (5 tabs: Overview/Activities/Stage History-as-visual-timeline/Contacts/AI Insights, plus Mark Won/Mark Lost/Assign quick actions). The account detail page's Deals tab (`/crm/accounts/[id]`) now renders the account's real deals instead of the Batch 1 placeholder. Sales Forecasts and Campaigns remain out of scope (CRM Batch 3).

**CRM Batch 3 (Sales Forecasts, Campaigns) is now fully built, completing the CRM pillar — all 7 CRM sidebar sub-items are now live** (Leads, Contacts, Accounts, Deals/Pipeline, Activities, Sales Forecasts, Campaigns — none show "Coming soon" anymore). Forecasts are computed live from `deals` at read time (`computeForecast()`, `lib/api/crm.ts` — pipeline/weighted/committed/won values plus a by-stage breakdown, filtered by `expectedCloseDate` range and optionally `ownerId`), never stored as a snapshot; a separate `forecast_targets` table holds only manually-set quota targets (period/period_type/period_start/period_end/target_value, `ownerId` null = org-wide target, non-null = per-rep). `forecast:set_target` is a distinct permission from `forecast:read` — same tiering rationale as `deal:close`, a manager/admin-level action not implied by ordinary read access. Campaigns were extended in place with the full field set (type/status/budget/channel/target_audience/etc.) and their metrics (leads/deals/revenue/ROI) are always computed live through two attribution paths (`computeCampaignMetrics()`, `lib/api/crm.ts`): `leads.campaignId` set directly, or `deals.convertedFromLeadId` pointing at a campaign-attributed lead (so a deal created by converting a campaign lead still counts even though the deal itself has no `campaignId`). `campaignRoi(revenueWon, budgetSpent)` returns `null` when spend is 0 rather than dividing by zero — every UI surface checks for null before rendering a percentage. `campaign:create/update/delete` are tightened to admin-only, a deliberate retightening from CRM Batch 1's flat grant that would otherwise have given "member" full campaign CRUD. UI: `/crm/forecasts` (period-type toggle monthly/quarterly/annual, owner filter, 5 summary cards including a color-coded Gap-to-Target, a Batch-2-style CSS bar trend chart across the last 6 periods, deals-closing-this-period table, by-rep breakdown table) and `/crm/campaigns` (KPI cards from `/api/crm/campaigns/stats`, a card grid with real computed metrics per campaign and a budget-spent progress bar) + `/crm/campaigns/[id]` (Overview/Leads/Deals/AI Insights tabs; Leads tab includes a funnel summary from total leads through won deals; no delete action in the UI since `app/api/crm/campaigns/[id]/route.ts` has no DELETE handler and was out of scope to add one to). The lead creation modal (`/crm/leads`) gained an optional Campaign dropdown (active campaigns only) that sets `leads.campaignId` on create — `app/api/crm/leads/route.ts`'s POST insert was missing `campaignId` entirely despite the column existing since Batch 1, a one-line fix. Five new AI touchpoints: analyze_forecast, analyze_campaign (Analyst), suggest_pipeline_actions, suggest_campaign_improvements (Planner), draft_campaign_copy (Writer, subject can be null for social/paid_ads types) — same `AiButton`+`AiSuggestionCard`/`useAiCall` pattern, none auto-submitting. This closes out CRM Batch 1-3 (Leads/Contacts/Accounts, Deals/Pipeline, Forecasts/Campaigns) as the full native CRM pillar scope from this section's original Phase 6 plan.

### Current Status (flag for future sessions)

As of this scope expansion, Communication remains integration-only per the section above (no native build). CRM is not planning-stage — see the CRM Batch 1 paragraph above for its actual status (Leads/Contacts/Accounts rebuilt; Deals/Campaigns/Forecasts pre-existing from earlier undocumented work, out of scope for this batch). HR Management is now fully built out (Prompts 5.1–5.4), all ten sidebar items real:

- Employee Directory + Onboarding (5.1) — `employees`/`onboarding_workflows`, `employee:{create,read,update,delete,terminate}`, `/hr/directory` list/detail (now `/hr/employees`, HR Batch 1), onboarding gated by HR admin OR the employee's direct manager (needs a linked login, per employees.userId).
- Attendance & Time Tracking (5.2, **restructured for self-service in HR Batch 2** — see the note below; this bullet describes the current shape, not the original 5.2 build) — `attendance_records` (`work_date`/`check_in_time`/`check_out_time`/`total_minutes`/`status`/location+manual-entry+audit fields) + `attendance_settings` (per-org workday/weekend/late-threshold config), `attendance:{record_own,view_own,view_all,edit_any}`, `/hr/attendance` (My Attendance + Team Today views, calendar heatmap, KPIs) + `/hr/attendance/settings` + a global check-in/out widget in the top bar (`components/hr/AttendanceWidget.tsx`).
- Leave Management (5.2, **restructured for self-service in HR Batch 2 Part 2** — see the note below; this bullet describes the current shape, not the original 5.2 build) — `leave_types` (category: name/color/is_paid/requires_approval/max_consecutive_days) + `leave_policies` (allotment rule attached to a type: annual_allotment_days/applies_to/carry_forward/effective_from) + `leave_balances` (stored, lazily created per employee/type/year — allotted/carried_forward/used/pending) + `leave_requests` (total_days/is_half_day/reason/status/reviewed_by/cancellation fields), `leave:{request_own,view_own,approve,view_all,configure,manage_balances}`, `/hr/leave` (My Leave / Approvals / Team Calendar / Policies tabs) + a Leave tab on Employee Detail.
- Payroll & Compensation (5.3, **extended in HR Batch 2 Part 3 for payslip generation** — see the note below; this bullet describes the current shape) — `compensation_records` (extended in place with `pay_frequency`/`deductions`, force-RLS added) + new `payslip_records` (record-keeping payslip snapshots: gross/deductions/net, `draft → finalized → paid` lifecycle, unique per employee/period so re-generation can't duplicate), `compensation:{create,update,delete,view_sensitive}` + new `payroll:{generate,finalize,mark_paid}`, `/hr/payroll` (period selector, generation, bulk finalize/mark-paid, PDF export via `@react-pdf/renderer`) + a rebuilt Employee Detail Compensation tab (current-record card, read-only history, payslip records section).
- Performance Reviews & OKRs, Recruitment/Hiring, HR Cases & Helpdesk, Learning & Training, Employee Engagement/Surveys (5.4) — `performance_reviews`+`okrs`, `job_postings`+`candidates`, `hr_cases`, `training_courses`+`training_completions`, `engagement_surveys`+`survey_responses`. Permissions consolidated by module, not by table — `performance`/`recruitment`/`hr_case`/`training`/`engagement` resourceTypes, each reusing the existing create/read/update/delete actions (no new permission_action values). `/hr/cases`, `/hr/learning`, `/hr/engagement` remain plain CRUD, no AI. **Performance Reviews & OKRs and Recruitment/Hiring were fully rebuilt in HR Batch 3** (superseding the plain-CRUD 5.4 build for those two modules specifically) — see the two paragraphs below for their access models and AI touchpoints. `review`/`okr` and `recruitment` are the resourceTypes involved: `review:{submit_self,submit_manager,view_own,view_team,view_all,configure}`, `okr:{create_own,create_team,view_own,view_team,view_all}`, `recruitment:{read,create_job,manage_candidates,schedule_interview,submit_feedback}`. `/hr/reviews` (My Reviews / Team Reviews / All Reviews / Cycles tabs) and `/hr/okrs` (My OKRs / Team OKRs) cover the review side; `/hr/recruitment` (Job Postings / All Candidates) plus `/hr/recruitment/[job_id]` (job detail, drag-and-drop candidate pipeline, candidate detail panel with interview scheduling and feedback) cover hiring. Six AI touchpoints: draft_self_assessment (Writer), summarize_review_feedback (Analyst), suggest_key_results (Planner), draft_job_posting (Writer), summarize_candidate (Analyst), suggest_interview_questions (Planner) — all through the shared `AiButton`+`AiSuggestionCard`/`useAiCall` pattern, none auto-submitting.
- Also added: `/hr/dashboard` (real stats only — Total Employees, Onboarding, Pending Leave Requests, Checked In Today, a native 7-day attendance chart; never fabricated "Total Applicants"/"Total Projects"-style numbers) and `/admin/members` (Members & Roles — invite/role-change/deactivate, gated on `organization:update`, no new permission type needed).

**Deviation from Prompts 5.2/5.3 as originally written, confirmed by Urvil:** HR Management launched with no employee self-service login path — every module (attendance, leave, compensation, and all five 5.4 modules) was HR-admin data entry/view only, an HR admin (owner/admin role) picking an employee from a dropdown and recording/viewing on their behalf, with no member/viewer default grant anywhere in HR Management. `compensation`'s self-view fallback (5.3's acceptance criteria originally required employee self-view) was removed from `requireCompensationViewAccess` (`lib/api/employees.ts`), and 5.4's five new resourceTypes were seeded owner/admin-only from the start rather than following the "member gets blanket read" default most other resourceTypes get. Onboarding and leave-approval manager-check paths (`requireEmployeeManageAccess`/`requireLeaveApproveAccess`) were left intact — a manager with a linked login can still approve their own reports' onboarding/leave; that wasn't part of this restriction.

**Reversed for Attendance specifically in HR Batch 2 Part 1 (confirmed by Urvil):** the blanket "no self-service" policy above was a scope-cut for speed during the early HR passes, not a permanent product philosophy — it contradicted the BRD's own goal of reducing administrative overhead once real usage would mean an admin manually punching every employee's clock. Attendance now has genuine employee self-service: `attendance:record_own`/`view_own` are granted to every role (including viewer) by default, an employee checks themself in/out via the global widget or `/hr/attendance`, and `attendance:view_all`/`edit_any` (owner/admin-only) cover HR oversight and manual backfill/correction — the old admin-only `attendance:record` action and its owner/admin-only grant (migration `0035_restrict_hr_self_service_to_admin.sql`) were replaced outright, not kept alongside the new model.

**Reversed for Leave specifically in HR Batch 2 Part 2 (confirmed by Urvil), same reasoning as Attendance above:** Leave Management now has genuine employee self-service too. `leave:request_own`/`view_own` are granted to every role (including viewer) by default — an employee picks a leave type, date range (or half-day), and optional reason, and submits their own request via `/hr/leave`'s "Request Leave" modal or the Employee Detail Leave tab. Approval stays manager/HR-admin only: `leave:approve` requires the caller to actually be the requester's manager (`isManagerOf`, `lib/api/employees.ts`) or hold `leave:view_all` — the grant alone isn't sufficient, same "manager isn't a role" pattern documented for onboarding/leave-approval above, now formalized as `requireLeaveApproveAccess` in `lib/api/leave.ts`. `leave:configure` (types/policies) and `leave:manage_balances` (manual balance corrections, always audit-logged) remain owner/admin-only. The old admin-only `leave:request` action and its owner/admin-only grant were replaced outright, along with the underlying schema — `leave_policies` used to double as "the type" (just a name + days/year, no separate leave_types table, balance computed live on every read); it's now split into `leave_types` (the category) + `leave_policies` (the allotment rule) + `leave_balances` (a real stored per-employee/type/year row, lazily created on first request), restructured in place rather than built as a second parallel system — the one real "PTO" policy that existed pre-Batch-2 was migrated into a `leave_type`+`leave_policy` pair rather than discarded (migration `0077_leave_self_service_restructure.sql`).

**Compensation and all five Prompt 5.4 modules remain HR-admin-only** — both self-service reversals (Attendance, Leave) were scoped to those two modules alone; whether to extend self-service to any 5.4 module is a separate decision Urvil hasn't made, not something to assume from either precedent.

**Performance Reviews (HR Batch 3) is a genuinely distinct third access pattern, not a variant of either precedent above.** Attendance/Leave are full self-service (the employee owns the whole record end-to-end); Compensation is zero-self-service (admin-only, no employee access to any part of it). Reviews split a single row into three independently-gated tiers instead: an employee owns `self_assessment` (`review:submit_self` + the review's `employee_id` must resolve to their own linked `employees` row — checked by `requireReviewSelfAccess`, `lib/api/reviews.ts`), their manager owns `manager_assessment`+`final_rating` (`review:submit_manager` + `isManagerOf`, the same "grant alone isn't sufficient" shape as `requireLeaveApproveAccess` — checked by `requireReviewManagerAccess`), and HR admin can configure cycles and see everything (`review:configure`, `review:view_all`). The two writes are hard-separated at the route level (`PATCH /api/reviews/[id]/self-assessment` vs. `manager-assessment`), so there's no code path where an employee's self-assessment submission could touch the manager's fields or vice versa — verified directly in `db/test-reviews-batch3-verify.ts`. `review:view_own`/`view_team`/`view_all` layer three more read tiers on top (own review, direct reports via `isManagerOf`, org-wide). OKRs follow a lighter version of the same idea — `okr:create_own` for your own objective, `okr:create_team` for team-level or someone else's, `okr:view_own`/`view_team`/`view_all` mirroring the review read tiers.

**Recruitment/Hiring (HR Batch 3) has no candidate-facing portal at all** — candidates aren't Centr8 OS users, so unlike Reviews' three-way split, access here is entirely internal-staff: `recruitment:read` for visibility, `recruitment:create_job`/`manage_candidates`/`schedule_interview` grid-granted to whichever roles hold them (owner/admin/member, i.e. "hiring manager can be any role," not a fixed HR-admin-only gate), and `recruitment:submit_feedback` layers on a specific-assignment check (`requireInterviewFeedbackAccess`) — holding the grant isn't enough, the caller must be the exact interviewer named on that interview's `interviewer_id`, verified against their own linked `employees` row. A different interviewer, even one with `submit_feedback`, is still denied for someone else's interview — the client doesn't try to replicate this check, it just submits and surfaces the resulting 403.

**Payroll & Compensation specifically is a permanent, deliberate scope boundary — not a "not yet built" gap, confirmed explicitly when HR Batch 2 Part 3 (payslip generation) was commissioned.** Unlike Attendance and Leave, there is no planned self-service reversal here: `compensation:*` and `payroll:*` are Admin-only (owner/admin), full stop, with zero grant to member/viewer and no self-view fallback for an employee to see their own salary. This module is, and is meant to stay, structured record-keeping only — no tax withholding, no statutory computation (PF/ESI/TDS), no bank disbursement, no payroll-provider integration. If a future prompt proposes self-service or compliance/tax logic for this pillar, that is a scope change requiring explicit confirmation, not an extension of the Attendance/Leave pattern.

**HR Cases & Helpdesk, Learning & Training, and Employee Engagement/Surveys (HR Batch 4) are now fully built, closing out all 10 HR Management sidebar sub-items.** Each is a fourth (or further) distinct access-pattern variant on top of the three already documented above (Attendance/Leave full self-service, Compensation zero-self-service, Reviews' hybrid split): HR Cases is full self-service raise (`hr_case:create_own`/`view_own`, every role) + admin-managed resolution (`hr_case:manage`) — a case is cleanly separable per-record into "the raiser's side" and "the handler's side" rather than split within a single row the way Reviews is. Training is self-service consumption (`training:read`/`enroll_own`/`view_own`, every role) + admin-only authoring and oversight (`training:manage`/`view_all_progress`). Surveys is self-service response (`engagement:respond`/`view_own`, every role) + admin-only authoring/results (`engagement:manage`/`view_results`) — and here the anonymity guarantee is structural, not a UI convention: an anonymous response's `survey_responses` row never has `employee_id` populated (enforced in `submitResponse`, `lib/api/surveys.ts`), duplicate-submission prevention is handled by a separate `survey_respondents` table that always carries the real `employee_id` but is never selected alongside `survey_responses.answers` anywhere in the codebase, and `db/test-surveys-batch4-verify.ts` verifies this directly (null `employee_id` on the response row, a real `employee_id` on the respondent row, a 409 on re-submission, and that the exact select shape the results route uses never carries an `employee_id` key). UI: `/hr/cases` (My Cases / All Cases / Categories tabs, confidential-case redaction respected client-side per what the API already redacts), `/hr/training` (Course Catalog / My Learning / Progress Overview — Learning & Training's route path, replacing the old `/hr/learning`), `/hr/surveys` (Active Surveys / Manage Surveys / Results — replacing the old `/hr/engagement`). Six AI touchpoints: suggest_case_triage, suggest_case_resolution (Analyst), recommend_courses_for_employee (Analyst), generate_course_outline (Writer), suggest_survey_questions (Planner), summarize_survey_results (Analyst) — all through the shared `AiButton`+`AiSuggestionCard`/`useAiCall` pattern, none auto-submitting.

**TODO (unresolved, flag if picked up in Batch 5+): `employees` vs `people` dual-directory.** PM's Team Directory (`people` table, resourcing-focused) and HR Management (`employees` table, HR-record-focused) are two separate, unlinked tables describing overlapping sets of humans. HR Batch 1 (Employee Directory + Onboarding rebuild) deliberately extended `employees` in place rather than merging into `people`, after an audit found 9 live FKs from already-built HR modules (attendance, leave, compensation, performance, recruitment, cases, training, engagement) pointing at `employees.id` — retargeting all of them was out of scope for that batch. This was an explicit, confirmed-with-Urvil scope decision, not an oversight: the merge is intentional-later, not forgotten. Before building anything that assumes one unified person record (e.g. a cross-pillar people search, or letting a PM project pull HR fields), re-raise this with Urvil rather than assuming either table is canonical.

## 11. Phase Gate Rule

Do not start a phase until the prior phase's acceptance criteria pass. Confirm completion with Urvil before moving forward. If a paid-tier substitution becomes unavoidable, flag it explicitly rather than silently switching — same rule as Recur8's Phase 3 gate with Chintan.
