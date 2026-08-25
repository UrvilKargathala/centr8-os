"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card, CardButton } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, Field, Textarea } from "@/components/ui/Input";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { PageSkeleton } from "@/components/ui/skeleton";

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "prd", label: "PRD" },
  { value: "sop", label: "SOP" },
  { value: "meeting_summary", label: "Meeting Summary" },
  { value: "release_notes", label: "Release Notes" },
  { value: "bug_report", label: "Bug Report" },
  { value: "test_cases", label: "Test Cases" },
  { value: "client_update", label: "Client Update" },
  { value: "executive_summary", label: "Executive Summary" },
];
const STATUS_COLOR: Record<string, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  reviewed: "warning",
  finalized: "success",
};

function docTypeLabel(value: string) {
  return DOC_TYPES.find((d) => d.value === value)?.label ?? value;
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.round(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export type Doc = {
  id: string;
  title: string;
  docType: string;
  status: string;
  createdAt: string;
  contextSource?: { projectId?: string } | null;
};
type Project = { id: string; name: string };

export function DocumentsPageClient({ initialDocs }: { initialDocs?: Doc[] }) {
  const router = useRouter();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [docs, setDocs] = useState<Doc[]>(initialDocs ?? []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(!initialDocs);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genDocType, setGenDocType] = useState("prd");
  const [genProjectId, setGenProjectId] = useState("");
  const [genContext, setGenContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const canCreate = can("document", "create");

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    const params = new URLSearchParams({ org_id: selectedOrgId });
    if (docTypeFilter) params.set("doc_type", docTypeFilter);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/ai/documents?${params}`)
      .then((r) => r.json())
      .then((body) => setDocs(body.data ?? []))
      .finally(() => setLoading(false));
  }
  const skippedInitialLoad = useRef(!!initialDocs);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, docTypeFilter, statusFilter]);

  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/projects?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setProjects(body.data ?? []));
  }, [selectedOrgId]);

  async function generate() {
    if (!selectedOrgId) return;
    setGenerating(true);
    setGenError(null);
    const res = await fetch("/api/ai/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: selectedOrgId,
        doc_type: genDocType,
        project_id: genProjectId || undefined,
        context: genContext || undefined,
      }),
    });
    const body = await res.json();
    setGenerating(false);
    if (!res.ok) return setGenError(body.error ?? "Failed to generate document");
    router.push(`/ai/documents/${body.data.id}`);
  }

  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;

  if (orgLoading || loading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Documents</h1>
          <p className="mt-1 text-body text-neutral-600">AI-generated PRDs, SOPs, reports, and more.</p>
        </div>
        {canCreate && <Button onClick={() => setShowGenerate(true)}>+ Generate Document</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Type">
          <Select className="w-40" value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select className="w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="reviewed">Reviewed</option>
            <option value="finalized">Finalized</option>
          </Select>
        </Field>
      </div>

      {docs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No documents yet</EmptyTitle>
            <EmptyDescription>Generate your first AI-drafted document.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <CardButton key={d.id} onClick={() => router.push(`/ai/documents/${d.id}`)} className="space-y-2">
              <p className="truncate font-medium text-neutral-950">{d.title}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge color="ai">{docTypeLabel(d.docType)}</Badge>
                <Badge color={STATUS_COLOR[d.status] ?? "neutral"}>{d.status}</Badge>
              </div>
              {projectName(d.contextSource?.projectId) && (
                <p className="text-small text-neutral-600">{projectName(d.contextSource?.projectId)}</p>
              )}
              <p className="text-caption text-neutral-500">{timeAgo(d.createdAt)}</p>
            </CardButton>
          ))}
        </div>
      )}

      {showGenerate && (
        <Modal onClose={() => setShowGenerate(false)}>
          <h2 className="text-h3 font-semibold text-neutral-950">Generate Document</h2>
          <div className="mt-4 space-y-3">
            <Field label="Document type">
              <Select className="w-full" value={genDocType} onChange={(e) => setGenDocType(e.target.value)}>
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project (optional)">
              <Select className="w-full" value={genProjectId} onChange={(e) => setGenProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Additional context (optional)">
              <Textarea className="w-full" rows={3} value={genContext} onChange={(e) => setGenContext(e.target.value)} />
            </Field>
            {genError && <p className="text-small text-danger-600">{genError}</p>}
            <div className="flex gap-2 pt-2">
              <Button onClick={generate} disabled={generating}>
                {generating ? `Writing your ${docTypeLabel(genDocType)}…` : "Generate"}
              </Button>
              <Button variant="secondary" onClick={() => setShowGenerate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
