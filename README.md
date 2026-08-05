# Centr8 OS

AI-native operating system for work. See [CLAUDE.md](./CLAUDE.md) for locked stack/architecture and [PHASE_PROMPTS.md](./PHASE_PROMPTS.md) for the build roadmap.

## Stack

- Next.js (App Router) — frontend + API routes, deployed on Vercel
- Neon Postgres — database (direct connection for migrations, pooled for runtime)
- Drizzle ORM — schema + migrations (`db/`)
- Supabase Auth — email/password now, SAML SSO placeholder wired in Phase 3
- AI agent calls run inline in Next.js API routes via `generateAI()` (`lib/ai/generate.ts`). No separate worker service.

No paid tiers are used. See CLAUDE.md §2 before adding any new service.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and fill in real values:
   - `NEON_DIRECT_URL` — Neon direct (non-pooled) connection string, used only for migrations
   - `NEON_POOLED_URL` — Neon pooled connection string, used by the app at runtime
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase project settings
   - `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never expose to the client
   - `SUPABASE_SSO_PROVIDER_ID` — leave blank until Phase 3
   - `GEMINI_API_KEY` — free-tier key from https://aistudio.google.com/apikey; `GEMINI_MODEL` defaults to `gemini-2.0-flash`
3. Run migrations against Neon:
   ```bash
   npm run db:generate   # generate SQL from db/schema.ts
   npm run db:migrate    # apply to NEON_DIRECT_URL
   ```
4. Seed dev data and verify tenant isolation + RBAC:
   ```bash
   npm run db:seed        # one test org, admin membership, department, team
   npm run db:test-rls    # asserts a user in Org A gets zero rows from Org B
   npm run db:test-rbac   # asserts a 'member' is blocked from deleting a project, etc.
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Verify the health check: `GET http://localhost:3000/api/health` → `{ "status": "ok" }`

## Multi-tenant data model & RLS

`db/schema.ts` defines the FR-1.x core: `organizations`, `org_memberships`, `departments`, `teams`, `audit_log` — every tenant table carries `org_id` and has an RLS policy scoping it to the caller's org memberships.

**Neon vs. Supabase gap, flagged per CLAUDE.md §11:** Supabase Auth's `auth.uid()`/RLS convenience only exists inside Supabase's *own* Postgres. Since Neon is the actual database here, `db/migrations/0000_auth_compat.sql` recreates the pieces the app needs:
- `auth.uid()` — reads a `request.jwt.claim.sub` session var the app must set (via `select set_config('request.jwt.claim.sub', $userId, true)`) after verifying the Supabase JWT, before running any RLS-scoped query.
- `auth.user_org_ids()` — `SECURITY DEFINER` lookup of the caller's org memberships (avoids `org_memberships`' own policy recursing into itself).
- `authenticated` role — created and granted to the Neon connection role, since Neon has no PostgREST-style roles out of the box.
- `service_role` (`BYPASSRLS`) — also granted to the Neon connection role, but never active by default. Only `set role service_role` for the duration of an admin operation (seeding, org provisioning) bypasses RLS; ordinary queries on the same connection stay scoped. This exists because forcing RLS (`db/migrations/0002_force_rls.sql`) creates a bootstrap problem — creating org #1 needs a membership row, which needs org #1 to already exist.
- Table-level `GRANT`s to `authenticated`/`service_role` (`db/migrations/0005_role_grants.sql`) — creating a role gives it nothing on its own; RLS only filters *which* rows a permitted statement can touch, so without a base `GRANT` every query 403s before RLS is even evaluated.

**The one that actually bit us:** Neon grants `BYPASSRLS` to its project-owner role by default (confirmed via `select rolbypassrls from pg_roles`) — the single role this project connects as for both `NEON_DIRECT_URL` and `NEON_POOLED_URL`. `FORCE ROW LEVEL SECURITY` (0002/0004) does nothing against that, since the bypass is a role attribute checked ahead of ownership. `db/withOrgContext.ts` therefore does `set role authenticated` before every request-scoped query, not just `set_config(...)` — without it, RLS silently no-ops and every query sees every org's rows. Any script that runs RLS-scoped queries against Neon needs the same `set role authenticated` step; `db/test-rls-isolation.ts` (which caught this) does it too.

The seed and RLS-test scripts use `@neondatabase/serverless`'s `Pool` (not the `neon-http` driver `db/index.ts` uses for app queries) because `set_config(..., true)`/`set role` need a session-scoped connection; `neon-http` issues each query as a stateless HTTP call.

## Work hierarchy (FR-2.x) & API routes

`db/schema.ts` adds Goals → Portfolios → Projects → Milestones → Sprints → Tasks, plus `task_dependencies` and `templates`. Same RLS pattern as Phase 1.2 (`db/migrations/0003_work_hierarchy.sql` + `0004_force_rls_work_hierarchy.sql`), with two wrinkles:
- `task_dependencies` has no `org_id` column (per spec) — it's a pure edge table, so its policy joins back to `tasks` to check both endpoints belong to the caller's org, instead of the usual `org_id in (...)` check.
- `templates.org_id` is nullable — `null` means a global template readable by every org. The select policy allows `org_id is null or ...`; every write policy still requires `org_id` to be one of the caller's own orgs, so a regular user can never create a global template (only `service_role` can, by inserting directly).

API route handlers use `db/withOrgContext.ts`, which opens a session-scoped connection, sets `request.jwt.claim.sub` from the authenticated Supabase user, and hands back a request-scoped drizzle instance — so RLS enforces org scoping underneath the app-layer checks, not instead of them.

Routes: `/api/projects`, `/api/projects/[id]`, `/api/milestones`, `/api/sprints`, `/api/sprints/[id]`, `/api/tasks`, `/api/tasks/[id]`, `/api/tasks/[id]/dependencies`. All expect a Supabase session cookie; unauthenticated requests get `401`.

**Dependency cycle check** (`POST /api/tasks/[id]/dependencies`): before inserting `task_id -> depends_on_task_id`, a recursive CTE walks the existing dependency graph outward from `depends_on_task_id`; if that walk can already reach `task_id`, the new edge would close a loop and the request is rejected with `409`. Self-dependency is rejected at `400` (and backstopped by a DB check constraint).

Manual walkthrough once `npm run dev` is up and you have a session cookie for a user in an org:
```bash
# project -> milestone -> sprint -> task chain
curl -X POST localhost:3000/api/projects -d '{"org_id":"...","name":"Launch"}'
curl -X POST localhost:3000/api/milestones -d '{"org_id":"...","project_id":"<projectId>","name":"Beta"}'
curl -X POST localhost:3000/api/sprints -d '{"org_id":"...","project_id":"<projectId>","name":"Sprint 1"}'
curl -X POST localhost:3000/api/tasks -d '{"org_id":"...","project_id":"<projectId>","title":"Set up CI"}'

# cycle rejection: A depends on B, B depends on C, then C depends on A
curl -X POST localhost:3000/api/tasks/$A/dependencies -d '{"depends_on_task_id":"'$B'","type":"blocks"}'
curl -X POST localhost:3000/api/tasks/$B/dependencies -d '{"depends_on_task_id":"'$C'","type":"blocks"}'
curl -X POST localhost:3000/api/tasks/$C/dependencies -d '{"depends_on_task_id":"'$A'","type":"blocks"}'
# -> 409 { "error": "This dependency would create a circular reference" }
```

## Permissions (FR-1.3) & custom roles

`org_memberships.role` is plain `text`, not a Postgres enum — a closed enum can't hold roles an org creates at runtime, and FR-1.3 requires custom roles. What a role can actually do lives in a separate `permissions` table: `(org_id nullable, role, resource_type, action)`. `org_id is null` rows are the built-in defaults for `owner`/`admin`/`member`/`viewer`, seeded once in `db/migrations/0008_seed_default_permissions.sql`:

| Role | Access |
|---|---|
| `owner` | full CRUD on everything, including deleting the organization |
| `admin` | full CRUD on everything except deleting the organization |
| `member` | read-only on org/department/team/project/milestone/sprint; full CRUD on `task` and `task_dependency` |
| `viewer` | read-only on everything |

An org can add its own rows (`org_id` = that org) to override a default or define a wholly new role name — `requirePermission()` checks org-specific and global (`org_id is null`) rows together, so custom roles slot in without touching the defaults. There's no admin UI for authoring custom roles yet (out of scope for this prompt), but the data model and enforcement path already support it.

`lib/api/permissions.ts` exports `requirePermission(db, userId, orgId, resourceType, action)` — table-driven, no role name ever appears in an `if` statement in route code. It looks up the caller's role in `org_memberships`, then checks `permissions` for a matching `(role, resourceType, action)` row (org-specific or global); no match throws `ApiError(403, ...)`. It's called inside the same `withOrgContext` transaction as the mutation itself, using the resource's real `org_id` — for `POST` that's the request body, for `PATCH`/`DELETE`/dependency routes it's fetched from the existing row first (so a nonexistent/cross-org id still 404s via RLS before permission is even checked). Wired into every mutating route from Prompt 1.3: `projects`, `milestones` (create only — no update/delete routes exist yet), `sprints`, `tasks`, `tasks/[id]/dependencies`. Read (`GET`) routes are unchanged — access there is enforced by RLS alone, per the prompt's scope ("used in every API route that mutates data").

`db/test-rbac.ts` (`npm run db:test-rbac`) exercises the real `requirePermission()` + `withOrgContext()` path (not a reimplementation) end to end: confirms `admin` can delete a project, `member` gets a `403` on the same action, `viewer` is blocked from creating a task, `member` *can* create a task (proving it's role-based, not a blanket deny), and that a blocked delete attempt never touches the row while an admin's does.

## AI agent calls

All five composable agents (Planner/Monitor/Analyst/Writer/Communicator) are called inline from Next.js API routes via `generateAI()` (`lib/ai/generate.ts`). No separate worker process is needed.

- **Agent modules** (`lib/agents/`) — one file per agent: `planner.ts` (real Gemini-backed draft generation), `monitor.ts` (health signals + Gemini summary), and scaffolded `analyst.ts`/`writer.ts`/`communicator.ts`.
- **`lib/ai/generate.ts`** routes through mock responses by default (`NEXT_PUBLIC_AI_PROVIDER=mock`); switching to a real LLM provider requires zero UI changes.
- **Every AI call — success or failure — gets one `audit_log` entry** written by the API route itself with `tier`, `input`, `output`, and `org_id` in `metadata`. Action names: `ai_project_draft_generated`, `project_health_snapshot_generated`; a failed call appends `_failed`.
- **`agent_jobs` table** exists in the schema but is no longer written to. It was previously used by a Railway worker; that architecture was removed.

## AI: natural-language project creation (FR-7.x, Tier 0 — Suggest Only)

Three routes, split so the boundary CLAUDE.md §4 requires ("Tier 0 — Suggest Only: AI proposes, human must trigger") is a hard code boundary, not just a convention:

- `POST /api/ai/create-project-draft` — takes `{ org_id, prompt }`, calls `generateAI("Planner", "create_project_draft", ...)` inline, returning `{ draft }` where `draft` is `{ goal, project, milestones[], sprints[], tasks[] }`. **Writes nothing to `goals`/`projects`/`milestones`/`sprints`/`tasks`** — the only DB write is an `audit_log` entry (`actor_type: 'ai'`, `action: 'ai_project_draft_generated'`), holding the prompt and full draft in `metadata`. Gated by `requirePermission(..., "project", "create")` before the AI call, so drafting doesn't burn Gemini quota for a user who couldn't act on it anyway.
- `POST /api/ai/create-project-draft/accept` — the *only* route allowed to turn a draft into real rows, and only ever called from an explicit "Accept & Create" click. Checks `requirePermission` for `goal`/`project`/`milestone`/`sprint`/`task` create (all four, even if a list is empty, so a partial-permission user can't sneak in some of the structure), then inserts everything inside one `withOrgContext` transaction, then logs a second `audit_log` row (`actor_type: 'human'`, `action: 'ai_project_draft_accepted'`, `target_type: 'project'`, `target_id`: the new project, `metadata.draftId` linking back to the generation log entry).
- `POST /api/ai/create-project-draft/reject` — logs `audit_log` (`actor_type: 'human'`, `action: 'ai_project_draft_rejected'`, `metadata.reason` if the reviewer gave one) — nothing else. Deliberately distinct from "Discard" in the UI, which clears local state with **no** server call at all; Reject is a real, permanent reviewer decision, same as Accept.

Two schema mismatches the draft shape has to route around, both are just dropped/ignored rather than worked around with new columns (not asked for):
- `projects` has no `description` column (Prompt 1.3 schema) — the draft's `project.description` is shown in the review UI but never persisted.
- `tasks` has no `milestone_id` (only `sprint_id`) — the draft links tasks to sprints via `sprint_index`; there's no equivalent for milestones.

Review UI at `/ai/create-project` (`app/(app)/ai/create-project/page.tsx` — org comes from the shared org context, not a pasted ID): free-text prompt in, an editable form out — every field (goal, project, milestones, sprints, tasks incl. sprint assignment) is a controlled input over local draft state, nothing round-trips to the server until Accept or Reject. The provisional banner ("AI-generated — review before accepting", `components/ui/AiBanner.tsx`, DESIGN_SYSTEM.md §5's locked pattern) sits above the form for as long as a draft is unaccepted. Accept/Reject/Discard sit side by side — Accept (primary), Reject (danger — logs a rejection with an optional reason), Discard (secondary, silent).

`resource_type` gained a `goal` value (`db/migrations/0009_goal_permissions.sql` + `0010_seed_goal_permissions.sql`, same owner/admin-full vs. member/viewer-read-only split as the other org-structure types) since accepting a draft creates a `goals` row too and that needed its own permission gate.

Acceptance criterion verified by construction: `create-project-draft`'s handler has no `db.insert` call touching any of the five work-hierarchy tables — grep it if in doubt. AI calls run inline via `generateAI()`; on failure, an `audit_log` row is written (`ai_project_draft_generated_failed`, with `tier`/`input`/`output` in `metadata`) and the route surfaces a `502`.

## AI: baseline health monitoring (FR-8.x subset, Tier 0 — read-only)

`POST /api/ai/project-health` calls `generateAI("Monitor", "project_health_scan", ...)` inline. Given `{ org_id, project_id }`:

1. The route resolves the project's name.
2. `generateAI` returns `{ signals, aiSummary }` — in mock mode this is canned data; with a real provider it would compute health signals from tasks/sprints and call Gemini for a plain-language summary.
3. The route writes an `audit_log` entry (`actor_type: 'ai'`, `action: 'project_health_snapshot_generated'`), then inserts `project_health_snapshots` (`org_id`, `project_id`, `signals` jsonb, `ai_summary` text, `created_at`). Nothing here ever touches `goals`/`projects`/`milestones`/`sprints`/`tasks`.

Two signal definitions worth knowing since neither maps to an obvious column:
- **Overdue** — tasks have no due-date column, so a task counts as overdue if it's open (not `done`/`cancelled`) and its sprint's `end_date` has passed. No sprint, no overdue signal for that task.
- **Blocked** — read off `task_dependencies`: a task is blocked if any dependency (`task_id -> depends_on_task_id`) points at a task that isn't `done`/`cancelled` yet.

`GET /api/ai/project-health?org_id=...` returns the latest snapshot per project (`selectDistinctOn` on `project_id`, ordered by `created_at desc`) for the dashboard at `/health` (`app/(app)/health/page.tsx`) — org ID in, cards out (summary text, task/overdue/blocked counts, per-sprint burn rate table), plus a small form to trigger a new scan for a given project ID.

`resource_type` gained `project_health_snapshot` (`db/migrations/0011`–`0013`) — `owner`/`admin`/`member` can trigger a scan (it costs a Gemini call) and everyone including `viewer` can read, matching the pattern that `viewer` never triggers side effects elsewhere in this app. Snapshots are immutable, so only `create`/`read` are seeded — no route updates or deletes one.

On failure, zero snapshot rows get written — the insert only runs after a successful `generateAI` call.

## UI shell & app screens (PHASE_PROMPT_UI.md Prompts 0.1–0.2)

Built directly against the real API routes above — `mockData.ts` was skipped per instruction, since the backend already existed. That meant solving two things the mock-data phase never had to:

- **Auth.** "A single logged-in mock user" isn't a thing once routes call `requireUserId()` for real. Added `app/login` (Supabase email/password sign-in) and `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts` mid-build — see the file for the migration note) — it refreshes the session cookie and redirects unauthenticated requests to `/login`, except for `/login`, `/portal`, and `/api/*` themselves.
- **Org context.** Mock data implicitly assumed one org. Real data doesn't know which org to scope a request to without asking — and there was no endpoint to even list "orgs this user belongs to." Added `GET /api/orgs` (RLS alone scopes it — no permission check needed for "list my own memberships") and `lib/context/OrgContext.tsx`, a client-side provider that loads the user's orgs once, defaults to the first (persisted to `localStorage` after that), and exposes `selectedOrgId` to every screen via the org switcher in the top bar.

One real gap found and fixed while wiring this up: `GET /api/projects` had no `org_id` filter — it returned every project across every org the caller belongs to. Fine for a single-org mock assumption, wrong for "show me *this* org's projects." Added the filter (backward compatible — omitting it keeps the old behavior).

**Route structure** (`app/(app)/`, a route group so it doesn't add a URL segment): `dashboard`, `projects`, `projects/[id]`, `sprints`, `tasks`, `executive` — all through one `layout.tsx` that wraps children in `OrgProvider` + `AppShell` (sidebar + top bar with the org switcher). `app/portal/[org_slug]` sits outside the group entirely, since client-portal users won't be `org_memberships` rows (Phase 3.1).

`sprints` and `tasks` are placeholder scaffolds, not oversight — `/api/sprints` and `/api/tasks` both require a `project_id` (no "list every sprint/task in the org" endpoint exists), so an org-wide board needs either a project picker first or a new aggregate endpoint, neither of which Prompt 0.1 asked for. They're real today scoped to one project, under a project's Sprints/Tasks tabs.

**Project list** (`/projects`): cards with name, status badge, milestone count (fetched per-project — fine at this scale, not worth a new aggregate endpoint yet), and a **real** health indicator — Prompt 0.2 asked for "a static/mock value for now," but Prompt 1.6 already built `project_health_snapshots` for real, so faking it here would've been a regression, not a phase-appropriate mock. Falls back to "No health scan yet" for projects with no snapshot.

**Project detail** (`/projects/[id]`): Overview (milestones + a real add-milestone form via `POST /api/milestones`) / Sprints / Tasks / Settings (editable name + status via `PATCH /api/projects/[id]`, exercising the RBAC gate for real — a `member` role gets a `403` here the same as everywhere else).

Also moved the two pre-existing standalone pages (`/ai/create-project`, `/health`, built in earlier prompts before this shell existed) into `app/(app)/`, swapping their manual "paste an org ID" text inputs for the shared org context — not asked for in this prompt, but leaving them as inconsistent orphans next to a newly-shell'd app would've been a worse outcome than the small diff to fold them in.

Shared primitives kept intentionally minimal for this phase — `components/ui/Badge.tsx` (status/priority color mapping, reused across list/detail so the same status always reads the same everywhere) and `components/AppShell.tsx`. A fuller component library is explicitly Prompt 0.6's job once more screens exist to see the real patterns across, not something to over-build now.

Verified against live Neon/Supabase in the browser, not just typecheck/build: signed in as a real user, confirmed the proxy redirect, the org switcher loading real memberships, a real project card with real milestone count and health fallback state, all three detail tabs rendering real milestones/sprints/tasks, and a real `PATCH` (status change) that persisted and reflected on reload. Zero console errors through the whole flow.

## Design system (DESIGN_SYSTEM.md)

Every token in the doc — typography, color, spacing, radius, elevation — is wired into Tailwind v4's CSS-first `@theme` config in `app/globals.css`, not left as documentation nobody reads while components use arbitrary Tailwind defaults. Two things worth knowing:

- **Fonts: Geom (headings) / Cabin (body) — explicit standing choice, supersedes §1.** DESIGN_SYSTEM.md §1 calls for Google Sans with an Inter fallback; that was the original build. A later explicit instruction overrode it: **Geom for all headings, Cabin for all body text, everywhere, going forward** — both are real Google Fonts, loaded via `next/font/google` in `app/layout.tsx` (`--font-heading-family`, `--font-primary`). Applied at the CSS-class level in `app/globals.css` (`.text-display`, `.text-h1`, `.text-h2`, `.text-h3` all get `font-family: var(--font-heading)`), not per-component — so it's automatic for every current *and future* use of those heading-scale classes, no risk of a new screen forgetting to opt in. If DESIGN_SYSTEM.md is ever revised, reconcile this override with §1 rather than silently reverting to Google Sans/Inter.
- **Spacing needed no override at all.** The doc's scale (`--space-1` = 4px ... `--space-16` = 64px) is the same 4px-base convention Tailwind's default spacing already uses — `p-6` is already 24px, `gap-4` is already 16px. Adding custom `--space-*` CSS variables would have just shadowed utilities that already matched, so standard Tailwind spacing utilities are used directly throughout.

Radius and type-scale tokens **did** need overrides: `--radius-md` is 10px in the doc vs. Tailwind's default 6px, so `app/globals.css` redefines `--radius-sm/md/lg` to override what `rounded-sm/md/lg` resolve to project-wide. The type scale uses the doc's own token names as Tailwind utility names — `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-body-medium`, `text-small`, `text-caption` all exist as real classes via Tailwind v4's `--text-{name}` theme key, bundling size + line-height per §1's table (font-weight isn't bundled by that mechanism, so each usage pairs the size utility with `font-semibold`/`font-medium`/`font-normal` per the doc's weight column).

**Dark mode was deliberately not built.** §5 lists it as "(if/when built)" with no concrete hex values given, and the neutral scale as specified (`neutral-50` near-white for cards, `neutral-950` near-black for text) is authored as a light UI. Inventing dark-mode hex values the doc never specified felt riskier than just building light mode as given and flagging the gap here.

**Badge color mapping is a closed table** (`components/ui/Badge.tsx`) — the doc's own status-mapping table only names five buckets (Not Started, In Progress, In Review, Blocked, Done) plus AI Draft, but this app has several concrete status vocabularies (project/sprint/task status, task priority) that don't 1:1 match those names. Every value is placed into the nearest semantic bucket with the reasoning written inline in the file rather than picked ad hoc — e.g. `on_hold` → warning (the doc explicitly describes warning-600 as "At-risk status"), task priority `medium`/`high` → warning/danger (the doc's Semantic Colors table explicitly calls out "medium priority" and "high risk" against those exact tokens).

The "AI-generated" banner (`components/ui/AiBanner.tsx`) implements §5's locked pattern once — `ai-100` background, `ai-600` left border, caption-weight label — and is reused wherever AI output appears (the draft-review screen; a smaller inline variant on the health dashboard's per-project AI summary). No emoji anywhere per §6.

## Sprint board & task views (PHASE_PROMPT_UI.md Prompt 0.3)

Same real-data approach as Prompts 0.1/0.2 — built against `/api/tasks`, `/api/sprints`, `/api/tasks/[id]/dependencies`, no mock data.

- **Sprint board** (`components/SprintBoard.tsx`, inside a project's Sprints tab — click a sprint to open its board): kanban columns by task status. Prompt 0.3's mock spec names four columns (To Do / In Progress / In Review / Done), but the real `task_status` enum has six values including `backlog` and `cancelled` — showing only four would make tasks in those two statuses silently vanish from the board, so all six are shown, horizontally scrollable on narrow viewports.
- **Drag-and-drop persists for real.** The prompt says "drag can be visual-only for now, doesn't need to persist anywhere yet" — but `PATCH /api/tasks/[id]` already exists and already enforces the RBAC gate, so faking the drag would be a regression from what's actually available, same reasoning as the health-indicator call in Prompt 0.2. Dragging a card calls `PATCH` with the new status, optimistically updates, and reverts to server truth if the request fails. Verified with a real drag in the browser, then confirmed via a direct API read (not just watching the UI) that the status change actually persisted. Dragging is disabled entirely when the active org role is `viewer`, consistent with viewer never triggering writes elsewhere in this app.
- **Task detail modal** (`components/TaskDetailModal.tsx`): title, description, status, priority, estimate, assignee, dependencies — all editable, saved via the same `PATCH`. Dependencies resolve their `depends_on_task_id` to a real title via `GET /api/tasks/[id]` per dependency (no endpoint joins titles server-side; same small-N per-item resolution pattern as the project list's milestone counts), and support add/remove through the existing dependency endpoints (add reuses the cycle-rejection `409` already built in Prompt 1.3). **Real gap, not a mock limitation**: there's no user-directory endpoint anywhere in this backend, so "assignee" is a raw user ID text field, not a name picker — flagging this now since it'll need a `/api/users` (or similar) endpoint before assignee can be a real people-picker.
- **Task list/table view** (project detail's Tasks tab): the filterable alternative to the board, filtering client-side against the already-fetched real task array — functionally identical to what the mock spec asked for ("filtering can run client-side against mockData.ts"), just against a real array instead of a fake one. Filters: status, priority, assignee ID (substring match, same raw-ID caveat as above).

`lib/constants.ts` was added to de-duplicate the status/priority arrays that had been separately declared in the AI draft page and the project detail page — both now import from one place.

## Dashboards (PHASE_PROMPT_UI.md Prompt 0.4)

Real data for everything the backend actually has; hardcoded-but-clearly-labeled for the one piece it doesn't (recommended actions), exactly as the prompt itself asks for that piece specifically.

- **Main dashboard** (`/dashboard`): active-projects overview (real, filtered client-side from `/api/projects`), task counts by status (real — see below), recent activity feed (real, see below). The prompt says all three should be mock; two already had a real data source, so building them mocked would've been a regression from what Prompts 0.2/1.3 already wired up.
- **Executive dashboard** (`/executive`): portfolio rollup by project status (real), per-project health summary (real — reuses the exact `/api/ai/project-health` data and AI-banner treatment from Prompt 0.2's project list), recommended actions (**hardcoded**, per the prompt's own instruction — the Analyst agent that would generate these is Phase 2.7, not built yet). The mock list is visually identical to the real AI-summary treatment (`ai-100`/`ai-600` tokens, "AI" badge) and carries an explicit "Placeholder content — becomes real... (Prompt 2.7)" caption, so it reads as provisional rather than as a bug when Prompt 2.7 lands and the two need to be told apart.
- **New endpoint**: `GET /api/audit-log?org_id=...&limit=...` — not asked for by name, but `audit_log` already exists as a real, RLS-scoped table that every AI-Tier-0 action already writes to (draft generation/acceptance, health scans), and the prompt's "recent activity feed (mock entries)" had a real source sitting right there unused. Read-only, same justification as `/api/orgs`: RLS alone scopes it, no route existed to read it before this.
- **Task counts by status** has no aggregate endpoint either (same gap as the sprint board's need for per-project task fetches) — computed by fetching tasks per project and aggregating client-side, identical pattern to the project list's milestone counts.

**Worth knowing, not a bug**: the activity feed was empty on first load in testing — correctly so. Regular CRUD routes (`POST /api/projects`, `POST /api/tasks`, etc.) were never wired to write `audit_log`; only the two AI-Tier-0 routes are. Verified the feed renders correctly by inserting real rows directly, but flagging this because "why is my activity feed empty" will come up the first time someone creates a project by hand and expects to see it there — closing that gap (writing audit_log entries from every mutating route) is a real, separate decision, not something to sneak in silently while building a display screen.

## Project layout

- `app/api/health` — health-check route
- `app/api/projects`, `app/api/milestones`, `app/api/sprints`, `app/api/tasks` — work hierarchy CRUD
- `app/api/tasks/[id]/dependencies` — dependency create/list/delete with cycle rejection
- `app/api/ai/create-project-draft` — Tier 0 draft generation (no work-hierarchy writes)
- `app/api/ai/create-project-draft/accept` — the only route that writes the accepted draft
- `app/api/ai/create-project-draft/reject` — logs a rejection (`audit_log` only, distinct from silent client-side Discard)
- `app/api/ai/project-health` — on-demand health scan (`POST`) + latest-per-project read (`GET`)
- `app/api/orgs` — list the current user's org memberships (org-switcher data source)
- `app/api/audit-log` — read-only recent-activity feed (org-scoped, no permission gate beyond RLS)
- `proxy.ts` — session refresh + auth-guard redirect to `/login` (Next.js 16's `middleware.ts` replacement)
- `app/login` — Supabase email/password sign-in
- `app/(app)/layout.tsx` — wraps `dashboard`/`projects`/`sprints`/`tasks`/`executive`/`ai`/`health` in `OrgProvider` + `AppShell`
- `app/(app)/dashboard` — active projects, task counts by status, real activity feed
- `app/(app)/executive` — portfolio rollup, per-project health, mocked-but-labeled recommended actions
- `app/(app)/projects`, `app/(app)/projects/[id]` — real project list + detail (Overview/Sprints/Tasks/Settings tabs)
- `app/(app)/ai/create-project` — review UI: provisional banner, editable draft, Accept & Create / Discard
- `app/(app)/health` — health dashboard: latest snapshot per project, plus a "run scan" form
- `app/portal/[org_slug]` — client-portal placeholder (Phase 3.1), outside the authenticated shell
- `lib/context/OrgContext.tsx` — client-side org selection, persisted to `localStorage`
- `components/AppShell.tsx` — sidebar/top bar shell
- `components/ui/Badge.tsx`, `components/ui/Button.tsx`, `components/ui/AiBanner.tsx`, `components/ui/StatTile.tsx` — DESIGN_SYSTEM.md-tokened primitives: status/priority badges, primary/secondary buttons, the locked AI-generated-content banner, dashboard stat cards
- `components/SprintBoard.tsx`, `components/TaskCard.tsx`, `components/TaskDetailModal.tsx` — kanban board (real drag-and-drop persistence), task card, task detail/edit modal
- `lib/constants.ts` — shared status/priority enum-value lists + labels
- `app/globals.css` — DESIGN_SYSTEM.md tokens as Tailwind v4 `@theme` config (colors, radius, elevation, type scale)
- `lib/api/helpers.ts` — `requireUserId()` / `ApiError` / `handleApiError()` shared by route handlers
- `lib/api/permissions.ts` — `requirePermission()`, the table-driven RBAC check (FR-1.3)
- `lib/ai/gemini.ts` — Gemini client: draft JSON generation + health-summary text generation
- `lib/ai/projectDraft.ts` — shared `ProjectDraft` type (route handlers + review UI)
- `lib/ai/healthSignals.ts` — `computeProjectHealthSignals()`, read-only signal computation
- `db/schema.ts` — Drizzle schema: enums, tables, RLS policies
- `db/migrations/` — generated SQL migrations (`0000` auth compat shims, `0001` org core tables, `0002` force RLS, `0003` work hierarchy tables, `0004` force RLS on work hierarchy, `0005` role grants, `0006` permissions table + `org_memberships.role` → text, `0007` force RLS on permissions, `0008` seed default permission matrix, `0009`–`0010` add + seed `goal` permission rows, `0011`–`0013` `project_health_snapshots` table + `project_health_snapshot` permission rows)
- `db/withOrgContext.ts` — session-scoped, RLS-bound drizzle instance for API route handlers
- `db/seed.ts` — dev seed (test org, admin membership, department, team)
- `db/test-rls-isolation.ts` — acceptance check: User A in Org A sees zero Org B rows
- `db/test-rbac.ts` — acceptance check: `member` blocked (`403`) from deleting a project, `admin` allowed
- `drizzle.config.ts` — points migrations at `NEON_DIRECT_URL`
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server Supabase client (Server Components/Route Handlers)
- `lib/supabase/sso.ts` — SSO config placeholder (Phase 3)
