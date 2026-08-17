"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { useAiUsage } from "@/lib/context/AiUsageContext";
import { Card } from "@/components/ui/Card";
import { Badge, cardAccentClass } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AiBanner } from "@/components/ui/AiBanner";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { PageSkeleton } from "@/components/ui/skeleton";

const DISMISSED_KEY = "centr8_dismissed_recommendations";

type Recommendation = {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  category: "project" | "hr" | "crm" | "capacity";
  action_type: "review" | "approve" | "investigate" | "reassign";
  linked_entity_type?: string;
  linked_entity_id?: string;
  reasoning: string;
};

const CATEGORIES = ["All", "project", "hr", "crm", "capacity"] as const;

function linkFor(rec: Recommendation): string | null {
  if (!rec.linked_entity_id) return null;
  if (rec.linked_entity_type === "project") return `/projects/${rec.linked_entity_id}`;
  if (rec.linked_entity_type === "deal") return `/crm/deals/${rec.linked_entity_id}`;
  if (rec.linked_entity_type === "employee") return `/team`;
  return null;
}

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function RecommendationsPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const { increment: incrementAi, cache: aiCache } = useAiUsage();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function load() {
    if (!selectedOrgId || loading) return;
    setLoading(true);
    fetch(`/api/ai/recommendations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        const result = body.data ?? [];
        setRecs(result);
        aiCache.set(`recs_${selectedOrgId}`, result);
        incrementAi();
        setLoaded(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setDismissed(getDismissed());
    if (selectedOrgId) {
      const cached = aiCache.get(`recs_${selectedOrgId}`) as Recommendation[] | undefined;
      if (cached) {
        setRecs(cached);
        setLoaded(true);
      }
    }
  }, [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  }

  const visible = useMemo(
    () => recs.filter((r) => !dismissed.includes(r.id) && (category === "All" || r.category === category)),
    [recs, dismissed, category],
  );
  const critical = visible.filter((r) => r.priority === "critical").length;
  const high = visible.filter((r) => r.priority === "high").length;

  if (orgLoading) return <PageSkeleton variant="cards" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  if (!loaded && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Recommendations</h1>
          <p className="text-body text-neutral-600">AI-surfaced actions worth your attention.</p>
        </div>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No recommendations loaded</EmptyTitle>
            <EmptyDescription>Click below to generate AI-powered recommendations based on your workspace data.</EmptyDescription>
          </EmptyHeader>
          <Button onClick={load}>Load recommendations</Button>
        </Empty>
      </div>
    );
  }

  if (loading) return <p className="text-body text-neutral-600">Generating recommendations…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Recommendations</h1>
          <p className="text-body text-neutral-600">AI-surfaced actions worth your attention.</p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Critical</p>
          <p className="text-h3 font-semibold text-neutral-950">{critical}</p>
        </Card>
        <Card padding="sm" color="warning">
          <p className="text-caption text-neutral-600">High</p>
          <p className="text-h3 font-semibold text-neutral-950">{high}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Total</p>
          <p className="text-h3 font-semibold text-neutral-950">{visible.length}</p>
        </Card>
      </div>

      <div className="flex w-fit gap-1 rounded-md border border-neutral-300 p-0.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-sm px-3 py-1 text-small font-medium capitalize ${
              category === c ? "bg-primary-600 text-neutral-50" : "text-neutral-600"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <AiBanner label="AI-generated recommendations — verify before acting" />

      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No recommendations</EmptyTitle>
            <EmptyDescription>Nothing needs your attention right now.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const href = linkFor(r);
            const accent = r.priority === "critical" ? "danger" : r.priority === "high" ? "warning" : "neutral";
            return (
              <Card key={r.id} className={cardAccentClass(r.priority === "medium" ? "neutral" : accent)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-neutral-950">{r.title}</p>
                    <p className="text-body text-neutral-600">{r.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge color="neutral">{r.category}</Badge>
                      <Badge color="info">{r.action_type}</Badge>
                    </div>
                    <button
                      className="pt-1 text-small text-primary-700 underline"
                      onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}
                    >
                      Why this recommendation?
                    </button>
                    {expanded[r.id] && <p className="text-small text-neutral-700">{r.reasoning}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {href && <Button href={href}>View</Button>}
                    <Button variant="secondary" onClick={() => dismiss(r.id)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
