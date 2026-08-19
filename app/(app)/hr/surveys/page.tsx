"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { SectionSkeleton } from "@/components/ui/skeleton";

type QuestionType = "rating_1_5" | "text" | "multiple_choice";
type Question = { id: string; text: string; type: QuestionType; options?: string[] };
type Survey = {
  id: string;
  title: string;
  description: string | null;
  questions: Question[];
  isAnonymous: boolean;
  status: "draft" | "active" | "closed";
  opensAt: string | null;
  closesAt: string | null;
};
type ResultQuestion =
  | { question_id: string; text: string; type: "rating_1_5"; average: number | null; distribution: Record<number, number>; response_count: number }
  | { question_id: string; text: string; type: "multiple_choice"; distribution: Record<string, number>; response_count: number }
  | { question_id: string; text: string; type: "text"; responses: string[]; response_count: number };
type Results = { survey_id: string; total_responses: number; questions: ResultQuestion[] };

const TABS = ["Active Surveys", "Manage Surveys", "Results"] as const;
type Tab = (typeof TABS)[number];

function newId() {
  return `q${Math.random().toString(36).slice(2, 8)}`;
}

export default function SurveysPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("engagement", "manage");
  const canViewResults = can("engagement", "view_results");
  const [tab, setTab] = useState<Tab>("Active Surveys");
  const [refreshKey, setRefreshKey] = useState(0);

  const visibleTabs = TABS.filter((t) => {
    if (t === "Manage Surveys") return canManage;
    if (t === "Results") return canViewResults;
    return true;
  });

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Employee Engagement</h1>
        <p className="mt-1 text-body text-neutral-600">Pulse surveys, feedback, and aggregated results</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Active Surveys" && <ActiveSurveysTab orgId={selectedOrgId} refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {tab === "Manage Surveys" && canManage && <ManageSurveysTab orgId={selectedOrgId} refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {tab === "Results" && canViewResults && <ResultsTab orgId={selectedOrgId} refreshKey={refreshKey} />}
    </div>
  );
}

function ActiveSurveysTab({ orgId, refreshKey, onChanged }: { orgId: string; refreshKey: number; onChanged: () => void }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responded, setResponded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/surveys?org_id=${orgId}`)
      .then((r) => r.json())
      .then(async (b) => {
        const active: Survey[] = (b.data ?? []).filter((s: Survey) => s.status === "active");
        setSurveys(active);
        const flags: Record<string, boolean> = {};
        await Promise.all(
          active.map(async (s) => {
            const detail = await fetch(`/api/surveys/${s.id}`).then((r) => r.json());
            flags[s.id] = detail.data?.hasResponded ?? false;
          }),
        );
        setResponded(flags);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId, refreshKey]);

  if (loading) return <SectionSkeleton variant="cards" />;
  if (surveys.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No active surveys</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {surveys.map((s) => (
        <Card key={s.id} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-medium font-semibold text-neutral-950">{s.title}</p>
            {responded[s.id] ? (
              <Badge color="success">Completed</Badge>
            ) : (
              <Button onClick={() => setRespondingId(s.id)}>Respond</Button>
            )}
          </div>
          {s.description && <p className="text-body text-neutral-600">{s.description}</p>}
        </Card>
      ))}
      {respondingId && (
        <RespondModal
          surveyId={respondingId}
          onClose={() => setRespondingId(null)}
          onSubmitted={() => {
            setRespondingId(null);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function RespondModal({ surveyId, onClose, onSubmitted }: { surveyId: string; onClose: () => void; onSubmitted: () => void }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}`).then((r) => r.json()).then((b) => setSurvey(b.data?.survey ?? null));
  }, [surveyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/surveys/${surveyId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(res.status === 409 ? "You have already responded to this survey." : body.error ?? "Failed to submit");
      return;
    }
    onSubmitted();
  }

  if (!survey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4" onClick={onClose}>
      <div className="glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="text-h3 font-semibold text-neutral-950">{survey.title}</h3>
          {survey.isAnonymous && (
            <p className="rounded-md bg-neutral-100 p-2 text-body text-neutral-700">
              This response is anonymous — it will not be linked to your identity.
            </p>
          )}
          {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
          {survey.questions.map((q) => (
            <Field key={q.id} label={q.text}>
              {q.type === "rating_1_5" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: String(n) }))}
                      className={`h-9 w-9 rounded-md border text-body-medium font-medium ${
                        answers[q.id] === String(n) ? "border-success-600 bg-success-100 text-success-600" : "border-neutral-300 text-neutral-700"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {q.type === "text" && (
                <Textarea className="w-full" rows={2} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
              )}
              {q.type === "multiple_choice" && (
                <Select className="w-full" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}>
                  <option value="">Select…</option>
                  {(q.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              )}
            </Field>
          ))}
          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit response"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManageSurveysTab({ orgId, refreshKey, onChanged }: { orgId: string; refreshKey: number; onChanged: () => void }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Survey | "new" | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/surveys?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setSurveys(b.data ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId, refreshKey]);

  async function updateStatus(s: Survey, status: string) {
    await fetch(`/api/surveys/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>+ New Survey</Button>
      </div>
      {loading ? (
        <SectionSkeleton variant="table" />
      ) : (
        <div className="space-y-3">
          {surveys.map((s) => (
            <Card key={s.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-body-medium font-semibold text-neutral-950">{s.title}</p>
                  <p className="text-caption text-neutral-500">{s.questions.length} question{s.questions.length === 1 ? "" : "s"} · {s.isAnonymous ? "Anonymous" : "Not anonymous"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select className="w-32" value={s.status} onChange={(e) => updateStatus(s, e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </Select>
                  <Button variant="secondary" onClick={() => setEditing(s)}>Edit</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <SurveyEditor
          orgId={orgId}
          survey={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function SurveyEditor({
  orgId,
  survey,
  onClose,
  onSaved,
}: {
  orgId: string;
  survey: Survey | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(survey?.title ?? "");
  const [description, setDescription] = useState(survey?.description ?? "");
  const [questions, setQuestions] = useState<Question[]>(survey?.questions ?? []);
  const [isAnonymous, setIsAnonymous] = useState(survey?.isAnonymous ?? true);
  const [status, setStatus] = useState(survey?.status ?? "draft");
  const [opensAt, setOpensAt] = useState(survey?.opensAt?.slice(0, 16) ?? "");
  const [closesAt, setClosesAt] = useState(survey?.closesAt?.slice(0, 16) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestAI = useAiCall<{ questions: { text: string; type: QuestionType; options?: string[] }[]; reasoning: string }>(
    "Planner",
    "suggest_survey_questions",
  );

  function addQuestion() {
    setQuestions([...questions, { id: newId(), text: "", type: "rating_1_5" }]);
  }
  function updateQuestion(i: number, fields: Partial<Question>) {
    setQuestions(questions.map((q, idx) => (idx === i ? { ...q, ...fields } : q)));
  }
  function removeQuestion(i: number) {
    setQuestions(questions.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      org_id: orgId,
      title,
      description: description || undefined,
      questions,
      is_anonymous: isAnonymous,
      status,
      opens_at: opensAt || undefined,
      closes_at: closesAt || undefined,
    };
    const res = survey
      ? await fetch(`/api/surveys/${survey.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/surveys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4" onClick={onClose}>
      <div className="glass max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="text-h3 font-semibold text-neutral-950">{survey ? "Edit survey" : "New survey"}</h3>
          {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
          <Field label="Title">
            <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Description">
            <Textarea className="w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <AiButton
            label="Suggest questions"
            loading={suggestAI.loading}
            onClick={() => suggestAI.run({ topic: title })}
          />
          {suggestAI.result && (
            <AiSuggestionCard
              reasoning={suggestAI.result.reasoning}
              onAccept={() => {
                setQuestions(suggestAI.result!.questions.map((q) => ({ id: newId(), text: q.text, type: q.type, options: q.options })));
                suggestAI.setResult(null);
              }}
              onReject={() => suggestAI.setResult(null)}
            >
              <ul className="list-disc pl-4 text-body text-neutral-700">
                {suggestAI.result.questions.map((q, i) => (
                  <li key={i}>{q.text} <span className="text-caption text-neutral-500">({q.type})</span></li>
                ))}
              </ul>
            </AiSuggestionCard>
          )}

          <div className="space-y-2">
            <p className="text-body-medium font-medium text-neutral-800">Questions</p>
            {questions.map((q, i) => (
              <div key={q.id} className="space-y-2 rounded-md border border-neutral-200 p-3">
                <div className="flex gap-2">
                  <Input className="w-full" value={q.text} onChange={(e) => updateQuestion(i, { text: e.target.value })} placeholder="Question text" />
                  <Select className="w-40" value={q.type} onChange={(e) => updateQuestion(i, { type: e.target.value as QuestionType })}>
                    <option value="rating_1_5">Rating 1-5</option>
                    <option value="text">Text</option>
                    <option value="multiple_choice">Multiple choice</option>
                  </Select>
                  <Button type="button" variant="secondary" onClick={() => removeQuestion(i)}>×</Button>
                </div>
                {q.type === "multiple_choice" && (
                  <Input
                    className="w-full"
                    value={(q.options ?? []).join(", ")}
                    onChange={(e) => updateQuestion(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                    placeholder="Options, comma-separated"
                  />
                )}
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addQuestion}>+ Add question</Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Field label="Anonymous">
              <Select className="w-32" value={isAnonymous ? "yes" : "no"} onChange={(e) => setIsAnonymous(e.target.value === "yes")}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select className="w-32" value={status} onChange={(e) => setStatus(e.target.value as Survey["status"])}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field label="Opens at">
              <Input type="datetime-local" className="w-48" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
            </Field>
            <Field label="Closes at">
              <Input type="datetime-local" className="w-48" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResultsTab({ orgId, refreshKey }: { orgId: string; refreshKey: number }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const summarizeAI = useAiCall<string>("Analyst", "summarize_survey_results");

  useEffect(() => {
    fetch(`/api/surveys?org_id=${orgId}`).then((r) => r.json()).then((b) => setSurveys(b.data ?? []));
  }, [orgId, refreshKey]);

  useEffect(() => {
    if (!surveyId) {
      setResults(null);
      return;
    }
    fetch(`/api/surveys/${surveyId}/results`).then((r) => r.json()).then((b) => setResults(b.data ?? null));
  }, [surveyId]);

  const averageRatings = results ? (results.questions.filter((q) => q.type === "rating_1_5" && q.average !== null) as { average: number }[]).map((q) => q.average) : [];

  return (
    <div className="space-y-4">
      <Field label="Survey">
        <Select className="w-72" value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
          <option value="">Select a survey…</option>
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </Select>
      </Field>

      {results && (
        <>
          <AiButton
            label="Summarize results"
            loading={summarizeAI.loading}
            onClick={() => summarizeAI.run({ total_responses: results.total_responses, average_ratings: averageRatings })}
          />
          {summarizeAI.result && (
            <AiSuggestionCard onAccept={() => summarizeAI.setResult(null)} onReject={() => summarizeAI.setResult(null)}>
              <p className="text-body text-neutral-700">{summarizeAI.result}</p>
            </AiSuggestionCard>
          )}

          <p className="text-body text-neutral-600">{results.total_responses} total responses</p>

          <div className="space-y-4">
            {results.questions.map((q) => (
              <Card key={q.question_id} className="space-y-2">
                <p className="text-body-medium font-semibold text-neutral-950">{q.text}</p>
                {q.type === "rating_1_5" && (
                  <div className="space-y-1">
                    <p className="text-body text-neutral-700">Average: {q.average !== null ? q.average.toFixed(1) : "—"} / 5 ({q.response_count} responses)</p>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="w-4 text-caption text-neutral-500">{n}</span>
                        <div className="h-2 flex-1 bar-track overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className="h-full bg-success-600"
                            style={{ width: `${q.response_count ? (q.distribution[n] / q.response_count) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-6 text-caption text-neutral-500">{q.distribution[n]}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === "multiple_choice" && (
                  <div className="space-y-1">
                    {Object.entries(q.distribution).map(([option, count]) => (
                      <div key={option} className="flex items-center gap-2">
                        <span className="w-32 truncate text-caption text-neutral-600">{option}</span>
                        <div className="h-2 flex-1 bar-track overflow-hidden rounded-full bg-neutral-200">
                          <div className="h-full bg-success-600" style={{ width: `${q.response_count ? (count / q.response_count) * 100 : 0}%` }} />
                        </div>
                        <span className="w-6 text-caption text-neutral-500">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === "text" && (
                  <ul className="space-y-1">
                    {q.responses.length === 0 && <p className="text-body text-neutral-500">No responses.</p>}
                    {q.responses.map((r, i) => (
                      <li key={i} className="rounded-md bg-neutral-100 p-2 text-body text-neutral-700">{r}</li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
