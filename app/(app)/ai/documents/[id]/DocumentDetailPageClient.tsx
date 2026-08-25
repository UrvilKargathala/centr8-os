"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AiBanner } from "@/components/ui/AiBanner";
import { PageSkeleton } from "@/components/ui/skeleton";

const DOC_TYPE_LABEL: Record<string, string> = {
  prd: "PRD",
  sop: "SOP",
  meeting_summary: "Meeting Summary",
  release_notes: "Release Notes",
  bug_report: "Bug Report",
  test_cases: "Test Cases",
  client_update: "Client Update",
  executive_summary: "Executive Summary",
};
const STATUS_COLOR: Record<string, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  reviewed: "warning",
  finalized: "success",
};

export type Document = {
  id: string;
  title: string;
  docType: string;
  status: "draft" | "reviewed" | "finalized";
  content: string;
  createdAt: string;
  contextSource?: { projectId?: string } | null;
};
export type Project = { id: string; name: string };

export type DocumentDetailInitialData = { doc: Document; project: Project | null };

export default function DocumentDetailPageClient({ initial }: { initial?: DocumentDetailInitialData }) {
  const { id } = useParams<{ id: string }>();
  const { can } = useOrg();
  const [doc, setDoc] = useState<Document | null>(initial?.doc ?? null);
  const [project, setProject] = useState<Project | null>(initial?.project ?? null);
  const [loading, setLoading] = useState(!initial);
  const [titleDraft, setTitleDraft] = useState(initial?.doc.title ?? "");
  const [contentDraft, setContentDraft] = useState(initial?.doc.content ?? "");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const canEdit = can("document", "create");
  const canUpdate = can("document", "update");
  const canFinalize = can("document", "finalize");

  function load() {
    setLoading(true);
    fetch(`/api/ai/documents/${id}`)
      .then((r) => r.json())
      .then((body) => {
        const d: Document = body.data;
        setDoc(d);
        setTitleDraft(d.title);
        setContentDraft(d.content);
        const pid = d.contextSource?.projectId;
        if (pid) {
          fetch(`/api/projects/${pid}`)
            .then((r) => r.json())
            .then((b) => setProject(b.data ?? null))
            .catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }
  const skippedInitialLoad = useRef(!!initial);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!doc) return;
    setSaving(true);
    await fetch(`/api/ai/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft, content: contentDraft }),
    });
    setSaving(false);
    load();
  }

  async function markReviewed() {
    setBusy(true);
    await fetch(`/api/ai/documents/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    load();
  }

  async function revertToDraft() {
    setBusy(true);
    await fetch(`/api/ai/documents/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revert: true }),
    });
    setBusy(false);
    load();
  }

  async function finalize() {
    setBusy(true);
    await fetch(`/api/ai/documents/${id}/finalize`, { method: "POST" });
    setBusy(false);
    load();
  }

  function exportPdf() {
    window.open(`/api/ai/documents/${id}/export`);
  }

  if (loading || !doc) return <PageSkeleton variant="detail" />;

  return (
    <div className="space-y-4">
      {doc.status === "draft" && <AiBanner label="AI-generated — review before finalizing" />}

      {doc.status === "draft" && canEdit ? (
        <Input className="w-full text-h2 font-semibold" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
      ) : (
        <h1 className="text-h2 font-semibold text-neutral-950">{doc.title}</h1>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge color="ai">{DOC_TYPE_LABEL[doc.docType] ?? doc.docType}</Badge>
        <Badge color={STATUS_COLOR[doc.status] ?? "neutral"}>{doc.status}</Badge>
        {project && (
          <Link href={`/projects/${project.id}`} className="text-small text-primary-700 underline">
            {project.name}
          </Link>
        )}
        <span className="text-caption text-neutral-500">Created {new Date(doc.createdAt).toLocaleDateString("en-US")}</span>
      </div>

      <Card>
        {doc.status === "draft" ? (
          <div className="space-y-3">
            <Textarea className="w-full" rows={20} value={contentDraft} onChange={(e) => setContentDraft(e.target.value)} />
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-body text-neutral-800">{doc.content}</pre>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {doc.status === "draft" && (
          <>
            {canUpdate && (
              <Button disabled={busy} onClick={markReviewed}>
                Mark as Reviewed
              </Button>
            )}
            <Button variant="secondary" onClick={exportPdf}>
              Export PDF
            </Button>
          </>
        )}
        {doc.status === "reviewed" && (
          <>
            {canFinalize && (
              <Button disabled={busy} onClick={finalize}>
                Finalize
              </Button>
            )}
            <Button variant="secondary" onClick={exportPdf}>
              Export PDF
            </Button>
            {canUpdate && (
              <Button variant="secondary" disabled={busy} onClick={revertToDraft}>
                Revert to Draft
              </Button>
            )}
          </>
        )}
        {doc.status === "finalized" && (
          <Button variant="secondary" onClick={exportPdf}>
            Export PDF
          </Button>
        )}
      </div>
    </div>
  );
}
