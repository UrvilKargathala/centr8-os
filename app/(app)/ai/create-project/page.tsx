"use client";

import { useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import type { ProjectDraft } from "@/lib/ai/projectDraft";
import { Button } from "@/components/ui/Button";
import { AiBanner } from "@/components/ui/AiBanner";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { PROJECT_STATUSES, SPRINT_STATUSES, TASK_PRIORITIES } from "@/lib/constants";

type CreatedResult = {
  goal: { id: string; title: string };
  project: { id: string; name: string };
  milestones: unknown[];
  sprints: unknown[];
  tasks: unknown[];
};

const EXAMPLE_PROMPTS = [
  "Launch a customer referral program by end of Q3, including a landing page, reward tracking, and email campaigns.",
  "Migrate our billing system to Stripe over the next 6 weeks, with a rollback plan and finance sign-off.",
  "Redesign the onboarding flow to cut signup drop-off, shipping in two 2-week sprints.",
  "Plan a 4-week hiring push for two senior engineers, from job posts through offer.",
];

export default function CreateProjectPage() {
  const { selectedOrgId, can, permissionsLoading } = useOrg();
  // Generate/Accept/Reject all gate on project:create server-side (drafts
  // are never persisted — Accept is the only path that creates a real
  // project row, and Reject just logs the decision) — same check for all
  // three so the UI doesn't invite a role into a flow it can't finish.
  const canCreateProject = can("project", "create");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejected, setRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedResult | null>(null);

  async function handleGenerate() {
    if (!selectedOrgId) return;
    setError(null);
    setCreated(null);
    setRejected(false);
    setRejectReason("");
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/create-project-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: selectedOrgId, prompt }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate draft");
      setDraft(body.data.draft);
      setDraftId(body.data.draftId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept() {
    if (!draft || !selectedOrgId) return;
    setError(null);
    setAccepting(true);
    try {
      const res = await fetch("/api/ai/create-project-draft/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: selectedOrgId, draft_id: draftId, draft }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create project");
      setCreated(body.data);
      setDraft(null);
      setDraftId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setAccepting(false);
    }
  }

  function handleDiscard() {
    // Silent, local-only — no server call. Distinct from Reject, which
    // logs a real reviewer decision.
    setDraft(null);
    setDraftId(null);
    setError(null);
  }

  async function handleReject() {
    if (!selectedOrgId) return;
    setError(null);
    setRejecting(true);
    try {
      const res = await fetch("/api/ai/create-project-draft/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: selectedOrgId, draft_id: draftId, reason: rejectReason || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to reject draft");
      setDraft(null);
      setDraftId(null);
      setRejectReason("");
      setRejected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject draft");
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">AI Project Creation</h1>

      {!permissionsLoading && !canCreateProject ? (
        <p className="rounded-md bg-warning-100 p-3 text-body text-warning-600">
          Your role doesn't allow creating projects, so drafts can't be generated or accepted here.
        </p>
      ) : (
        <Card padding="sm" className="space-y-4">
          {!draft && !created && (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ai-100 text-ai-600">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
                </svg>
              </span>
              <p className="text-h3 font-semibold text-neutral-950">What are you building?</p>
              <p className="text-small text-neutral-600">
                Describe the project in a sentence or two — the Planner agent drafts a goal, milestones, sprints, and tasks for you to review.
              </p>
            </div>
          )}

          <label className="block text-body-medium font-medium text-neutral-800">
            Describe the project
            <Textarea
              className="mt-1 w-full"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Launch a customer referral program by end of Q3, including a landing page, reward tracking, and email campaigns."
            />
          </label>

          {!draft && !created && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-caption text-neutral-700 hover:border-ai-600 hover:bg-ai-100 hover:text-ai-600"
                >
                  {p.length > 60 ? `${p.slice(0, 57)}…` : p}
                </button>
              ))}
            </div>
          )}

          <Button onClick={handleGenerate} disabled={generating || !selectedOrgId || !prompt}>
            {generating ? "Generating…" : "Generate Draft"}
          </Button>
        </Card>
      )}

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {created && (
        <div className="rounded-md bg-success-100 p-4 text-body text-success-600">
          <p className="font-medium">Created &quot;{created.project.name}&quot;</p>
          <p>
            Goal: {created.goal.title} · {created.milestones.length} milestones · {created.sprints.length} sprints ·{" "}
            {created.tasks.length} tasks
          </p>
        </div>
      )}

      {rejected && (
        <div className="rounded-md bg-neutral-200 p-4 text-body text-neutral-800">
          Draft rejected — logged to the audit trail. Nothing was created.
        </div>
      )}

      {draft && (
        <div className="space-y-5">
          <AiBanner />

          <Card padding="sm" className="space-y-2">
            <h2 className="text-h3 font-semibold text-neutral-950">Goal</h2>
            <Input 
              className="w-full"
              value={draft.goal.title}
              onChange={(e) => setDraft({ ...draft, goal: { ...draft.goal, title: e.target.value } })}
            />
            <Textarea 
              className="w-full"
              rows={2}
              value={draft.goal.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, goal: { ...draft.goal, description: e.target.value || null } })
              }
            />
          </Card>

          <Card padding="sm" className="space-y-2">
            <h2 className="text-h3 font-semibold text-neutral-950">Project</h2>
            <Input 
              className="w-full"
              value={draft.project.name}
              onChange={(e) => setDraft({ ...draft, project: { ...draft.project, name: e.target.value } })}
            />
            <Textarea 
              className="w-full"
              rows={2}
              placeholder="Description (not persisted — for review only)"
              value={draft.project.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, project: { ...draft.project, description: e.target.value || null } })
              }
            />
            <div className="flex flex-wrap gap-2">
              <Select
                
                value={draft.project.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    project: { ...draft.project, status: e.target.value as ProjectDraft["project"]["status"] },
                  })
                }
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input 
                type="date"
                
                value={draft.project.start_date ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, project: { ...draft.project, start_date: e.target.value || null } })
                }
              />
              <Input 
                type="date"
                
                value={draft.project.end_date ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, project: { ...draft.project, end_date: e.target.value || null } })
                }
              />
            </div>
          </Card>

          <Card padding="sm" className="space-y-2">
            <h2 className="text-h3 font-semibold text-neutral-950">Milestones ({draft.milestones.length})</h2>
            {draft.milestones.map((m, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Input 
                  className="flex-1"
                  value={m.name}
                  onChange={(e) => {
                    const next = [...draft.milestones];
                    next[i] = { ...next[i], name: e.target.value };
                    setDraft({ ...draft, milestones: next });
                  }}
                />
                <Input 
                  type="date"
                  
                  value={m.due_date ?? ""}
                  onChange={(e) => {
                    const next = [...draft.milestones];
                    next[i] = { ...next[i], due_date: e.target.value || null };
                    setDraft({ ...draft, milestones: next });
                  }}
                />
              </div>
            ))}
          </Card>

          <Card padding="sm" className="space-y-2">
            <h2 className="text-h3 font-semibold text-neutral-950">Sprints ({draft.sprints.length})</h2>
            {draft.sprints.map((s, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Input 
                  className="flex-1"
                  value={s.name}
                  onChange={(e) => {
                    const next = [...draft.sprints];
                    next[i] = { ...next[i], name: e.target.value };
                    setDraft({ ...draft, sprints: next });
                  }}
                />
                <Select
                  
                  value={s.status}
                  onChange={(e) => {
                    const next = [...draft.sprints];
                    next[i] = { ...next[i], status: e.target.value as ProjectDraft["sprints"][number]["status"] };
                    setDraft({ ...draft, sprints: next });
                  }}
                >
                  {SPRINT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </Select>
                <Input 
                  type="date"
                  
                  value={s.start_date ?? ""}
                  onChange={(e) => {
                    const next = [...draft.sprints];
                    next[i] = { ...next[i], start_date: e.target.value || null };
                    setDraft({ ...draft, sprints: next });
                  }}
                />
                <Input 
                  type="date"
                  
                  value={s.end_date ?? ""}
                  onChange={(e) => {
                    const next = [...draft.sprints];
                    next[i] = { ...next[i], end_date: e.target.value || null };
                    setDraft({ ...draft, sprints: next });
                  }}
                />
              </div>
            ))}
          </Card>

          <Card padding="sm" className="space-y-2">
            <h2 className="text-h3 font-semibold text-neutral-950">Tasks ({draft.tasks.length})</h2>
            {draft.tasks.map((t, i) => (
              <div key={i} className="space-y-1 border-b border-neutral-200 pb-2 last:border-b-0">
                <Input 
                  className="w-full"
                  value={t.title}
                  onChange={(e) => {
                    const next = [...draft.tasks];
                    next[i] = { ...next[i], title: e.target.value };
                    setDraft({ ...draft, tasks: next });
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Select
                    
                    value={t.priority}
                    onChange={(e) => {
                      const next = [...draft.tasks];
                      next[i] = { ...next[i], priority: e.target.value as ProjectDraft["tasks"][number]["priority"] };
                      setDraft({ ...draft, tasks: next });
                    }}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                  <Input 
                    type="number"
                    className="w-24"
                    placeholder="estimate"
                    value={t.estimate ?? ""}
                    onChange={(e) => {
                      const next = [...draft.tasks];
                      next[i] = { ...next[i], estimate: e.target.value ? Number(e.target.value) : null };
                      setDraft({ ...draft, tasks: next });
                    }}
                  />
                  <Select
                     className="flex-1"
                    value={t.sprint_index ?? ""}
                    onChange={(e) => {
                      const next = [...draft.tasks];
                      next[i] = { ...next[i], sprint_index: e.target.value ? Number(e.target.value) : null };
                      setDraft({ ...draft, tasks: next });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {draft.sprints.map((s, si) => (
                      <option key={si} value={si}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </Card>

          <div className="space-y-2">
            <label className="block text-body-medium font-medium text-neutral-800">
              Rejection reason (optional)
              <Input 
                className="mt-1 w-full"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. wrong scope, will re-prompt"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleAccept} disabled={accepting || rejecting}>
                {accepting ? "Creating…" : "Accept & Create"}
              </Button>
              <Button variant="danger" onClick={handleReject} disabled={accepting || rejecting}>
                {rejecting ? "Rejecting…" : "Reject"}
              </Button>
              <Button variant="secondary" onClick={handleDiscard} disabled={accepting || rejecting}>
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
