"use client";

import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import type { ProjectHealthSignals } from "@/lib/agents/monitor";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export type Snapshot = {
  id: string;
  projectId: string;
  projectName: string;
  signals: ProjectHealthSignals;
  aiSummary: string;
  createdAt: string;
};

export function HealthPageClient({ initialSnapshots }: { initialSnapshots?: Snapshot[] }) {
  const { selectedOrgId } = useOrg();
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scanProjectId, setScanProjectId] = useState("");
  const [scanning, setScanning] = useState(false);

  function loadSnapshots() {
    if (!selectedOrgId) return;
    setError(null);
    setLoading(true);
    fetch(`/api/ai/project-health?org_id=${selectedOrgId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load health snapshots");
        setSnapshots(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load health snapshots"))
      .finally(() => setLoading(false));
  }

  const skippedInitialLoad = useRef(!!initialSnapshots);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    loadSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  async function runScan() {
    if (!selectedOrgId) return;
    setError(null);
    setScanning(true);
    try {
      const res = await fetch("/api/ai/project-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: selectedOrgId, project_id: scanProjectId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to run health scan");
      loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run health scan");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Project Health</h1>
        <p className="mt-1 text-body text-neutral-600">
          Read-only, Tier 0. Signals are computed from current task/sprint data; nothing here writes back to them.
        </p>
      </div>

      <Card padding="sm" className="flex flex-wrap gap-2">
        <Input
          className="min-w-0 flex-1"
          value={scanProjectId}
          onChange={(e) => setScanProjectId(e.target.value)}
          placeholder="Project ID to scan"
        />
        <Button onClick={runScan} disabled={scanning || !selectedOrgId || !scanProjectId}>
          {scanning ? "Scanning…" : "Run health scan"}
        </Button>
      </Card>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <div className="space-y-4">
        {snapshots.map((s) => (
          <Card key={s.id} padding="sm" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <h2 className="text-h3 font-semibold text-neutral-950">{s.projectName}</h2>
              <span className="text-small text-neutral-600">{new Date(s.createdAt).toLocaleString("en-US")}</span>
            </div>

            <div className="border-l-4 border-ai-600 bg-ai-100 p-3">
              <p className="mb-1 text-caption font-medium uppercase tracking-wide text-ai-600">AI-generated summary</p>
              <p className="text-body text-neutral-800">{s.aiSummary}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>{s.signals.totalTasks} tasks</Badge>
              <Badge>{s.signals.openTasks} open</Badge>
              <Badge color="success">{s.signals.doneTasks} done</Badge>
              <Badge color={s.signals.overdueTasks > 0 ? "danger" : "neutral"}>{s.signals.overdueTasks} overdue</Badge>
              <Badge color={s.signals.blockedTasks > 0 ? "warning" : "neutral"}>{s.signals.blockedTasks} blocked</Badge>
            </div>

            {s.signals.sprints.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-small">
                  <thead>
                    <tr className="text-left text-neutral-600">
                      <th className="font-normal">Sprint</th>
                      <th className="font-normal">Status</th>
                      <th className="font-normal">Burn rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.signals.sprints.map((sp) => (
                      <tr key={sp.id}>
                        <td className="text-neutral-800">{sp.name}</td>
                        <td className="text-neutral-800">{sp.status}</td>
                        <td className="text-neutral-800">
                          {sp.doneTasks}/{sp.totalTasks} ({Math.round(sp.burnRate * 100)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
        {!loading && snapshots.length === 0 && <p className="text-body text-neutral-600">No snapshots yet — run a scan above.</p>}
      </div>
    </div>
  );
}
