"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { StatTile } from "@/components/ui/StatTile";
import { Badge, projectStatusColor, cardAccentClass } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PROJECT_STATUSES } from "@/lib/constants";

type Project = { id: string; name: string; status: string };
type HealthSnapshot = {
  projectId: string;
  projectName: string;
  aiSummary: string;
  signals: { overdueTasks: number; blockedTasks: number };
};
type Recommendation = {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  category: string;
  action_type: string;
};

export default function ExecutivePage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<HealthSnapshot[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/projects?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/ai/project-health?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/ai/recommendations?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([projectsBody, healthBody, recBody]) => {
        if (!projectsBody.data) throw new Error(projectsBody.error ?? "Failed to load projects");
        setProjects(projectsBody.data);
        setHealth(healthBody.data ?? []);
        setRecommendations(recBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load executive dashboard"))
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const countsByStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, projects.filter((p) => p.status === s).length]));
  const healthByProject = Object.fromEntries(health.map((h) => [h.projectId, h]));

  return (
    <div className="space-y-8">
      <h1 className="text-display font-semibold text-neutral-950">Executive Dashboard</h1>

      <section className="space-y-3">
        <h2 className="text-h3 font-semibold text-neutral-800">Portfolio rollup</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Total projects" value={projects.length} />
          {PROJECT_STATUSES.map((s) => (
            <StatTile key={s} label={s.replace(/_/g, " ")} value={countsByStatus[s]} color={projectStatusColor(s)} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-h3 font-semibold text-neutral-800">Project health</h2>
        {projects.length === 0 ? (
          <p className="text-body text-neutral-600">No projects yet.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const snap = healthByProject[p.id];
              const healthColor = !snap
                ? "neutral"
                : snap.signals.overdueTasks > 0
                  ? "danger"
                  : snap.signals.blockedTasks > 0
                    ? "warning"
                    : "success";
              return (
                <Card key={p.id} color={healthColor} padding="sm" className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-body-medium font-medium text-neutral-950">{p.name}</span>
                    {snap ? (
                      <div className="flex gap-2">
                        {snap.signals.overdueTasks > 0 && <Badge color="danger">{snap.signals.overdueTasks} overdue</Badge>}
                        {snap.signals.blockedTasks > 0 && <Badge color="warning">{snap.signals.blockedTasks} blocked</Badge>}
                        {snap.signals.overdueTasks === 0 && snap.signals.blockedTasks === 0 && (
                          <Badge color="success">On track</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-small text-neutral-400">No health scan yet</span>
                    )}
                  </div>
                  {snap && (
                    <div className="border-l-4 border-ai-600 bg-ai-100 px-3 py-2">
                      <p className="text-caption font-medium uppercase tracking-wide text-ai-600">AI-generated summary</p>
                      <p className="text-small text-neutral-800">{snap.aiSummary}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-neutral-800">Recommended actions</h2>
          <Button href="/ai/recommendations" variant="secondary">
            View all →
          </Button>
        </div>
        {recommendations.length === 0 ? (
          <p className="text-small text-neutral-600">No open recommendations.</p>
        ) : (
          <div className="space-y-2">
            {[...recommendations]
              .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2 };
                return order[a.priority] - order[b.priority];
              })
              .slice(0, 5)
              .map((r) => (
                <Card
                  key={r.id}
                  padding="sm"
                  className={cardAccentClass(r.priority === "critical" ? "danger" : r.priority === "high" ? "warning" : "neutral")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-medium font-medium text-neutral-950">{r.title}</p>
                      <p className="truncate text-small text-neutral-600">{r.description}</p>
                    </div>
                    <Badge color="ai">{r.priority}</Badge>
                  </div>
                </Card>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
