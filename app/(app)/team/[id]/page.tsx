"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Person } from "../TeamPageClient";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type Contribution = { iso: string; day: number; count: number };
function buildMonthGrid(
  dailyCounts: Record<string, number>,
  reference = new Date(),
): { label: string; cells: (Contribution | null)[]; total: number } {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = first.getDay();
  let total = 0;
  const dayCells: Contribution[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = dailyCounts[iso] ?? 0;
    total += count;
    return { iso, day, count };
  });
  return {
    label: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    cells: [...Array.from({ length: startOffset }, () => null), ...dayCells],
    total,
  };
}

const HEAT_TONES = ["bg-neutral-100", "bg-success-100", "bg-success-600", "bg-success-600"];

type Stats = {
  monthly: { month: string; count: number }[];
  daily: { day: string; count: number }[];
  utilization: { totalEstimate: number; openCount: number };
  recentTasks: { id: string; title: string; status: string; priority: string; dueDate: string | null; updatedAt: string }[];
};

const STATUS_LABEL: Record<string, string> = { todo: "Pending", in_progress: "In Progress", in_review: "In Review", done: "Done", backlog: "Backlog", cancelled: "Cancelled" };
const STATUS_COLOR: Record<string, string> = { done: "text-success-600", in_progress: "text-info-600", in_review: "text-warning-600", todo: "text-neutral-600" };

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [person, setPerson] = useState<Person | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/team/${id}`).then((r) => r.json()),
      fetch(`/api/team/${id}/stats`).then((r) => r.json()),
    ])
      .then(([personBody, statsBody]) => {
        if (personBody.data) setPerson(personBody.data);
        else setError(personBody.error ?? "Person not found");
        if (statsBody.data) setStats(statsBody.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  const dailyCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of stats?.daily ?? []) m[d.day] = d.count;
    return m;
  }, [stats]);

  const grid = useMemo(() => buildMonthGrid(dailyCounts), [dailyCounts]);

  const monthlyBars = useMemo(() => {
    const months = stats?.monthly ?? [];
    const now = new Date();
    const last7: { label: string; key: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last7.push({
        label: d.toLocaleDateString(undefined, { month: "short" }),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
    }
    const countByKey = new Map(months.map((m) => [m.month, m.count]));
    const bars = last7.map((m) => ({ label: m.label, count: countByKey.get(m.key) ?? 0 }));
    const max = Math.max(1, ...bars.map((b) => b.count));
    return { bars, max };
  }, [stats]);

  if (loading) return <PageSkeleton variant="detail" />;
  if (error || !person) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error ?? "Not found"}</p>;

  const joined = new Date(person.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const recentTasks = stats?.recentTasks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-200"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-heading text-h1 font-semibold text-neutral-950">Member Details</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* -- LEFT COLUMN -- */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-100 text-h2 font-semibold text-primary-700">
                {initials(person.fullName)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-h2 font-semibold text-neutral-950">{person.fullName}</h2>
                <p className="truncate text-body text-neutral-600">{person.workEmail}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <Fact icon={ICON_BADGE} label="Department" value={person.department ?? "Not set"} />
              <Fact icon={ICON_JOB} label="Job Title" value={person.jobTitle ?? "Not set"} />
              <Fact icon={ICON_TASKS} label="Open Tasks" value={String(stats?.utilization.openCount ?? 0)} />
              <Fact icon={ICON_CAL} label="Joined" value={joined} />
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-h3 font-semibold text-neutral-950">Recent Activity</h3>
              {!person.isActive && <Badge color="neutral">Inactive</Badge>}
            </div>
            {recentTasks.length === 0 ? (
              <p className="text-body text-neutral-600">No tasks assigned to this person yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {recentTasks.map((t) => {
                  const overdue = t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== "done" && t.status !== "cancelled";
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/tasks?q=${encodeURIComponent(t.title)}`} className="truncate text-body font-medium text-neutral-950 hover:text-primary-700">
                          {t.title}
                        </Link>
                        <p className="text-caption text-neutral-500">{new Date(t.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {overdue && <span className="text-caption font-medium text-danger-600">Overdue</span>}
                        <span className={`text-caption font-medium ${STATUS_COLOR[t.status] ?? "text-neutral-500"}`}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/team" className="mt-3 inline-block text-small font-medium text-primary-700 hover:underline">
              Back to Team
            </Link>
          </div>
        </div>

        {/* -- RIGHT COLUMN -- */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-h3 font-semibold text-neutral-950">Activity Map</h3>
              <span className="rounded-md border border-neutral-300 px-2 py-1 text-caption text-neutral-700">
                {grid.label}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="text-center text-caption text-neutral-500">{d}</span>
              ))}
              {grid.cells.map((c, i) => {
                if (!c) return <div key={i} className="h-6 w-full" />;
                const bucket = c.count === 0 ? 0 : c.count < 3 ? 1 : c.count < 6 ? 2 : 3;
                return (
                  <div
                    key={i}
                    className={`h-6 w-full rounded-sm ${HEAT_TONES[bucket]}`}
                    title={`${c.iso}: ${c.count} task${c.count === 1 ? "" : "s"} completed`}
                  />
                );
              })}
            </div>
            <p className="mt-3 text-center text-small text-neutral-600">
              {grid.total} task{grid.total === 1 ? "" : "s"} completed in {grid.label}
            </p>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">Task Performance</h3>
            <div className="mt-4 flex h-40 items-end gap-2">
              {monthlyBars.bars.map((b) => {
                const pct = monthlyBars.max > 0 ? Math.max(4, Math.round((b.count / monthlyBars.max) * 100)) : 4;
                return (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end">
                      <div
                        className={`w-full rounded-t-sm ${b.count > 0 ? "bg-primary-600" : "bg-neutral-200"}`}
                        style={{ height: `${b.count > 0 ? pct : 4}%` }}
                        title={`${b.count} completed`}
                      />
                    </div>
                    <span className="text-caption text-neutral-500">{b.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-center text-small text-neutral-600">
              Tasks completed per month (last 7 months)
            </p>
          </div>

          <div className="glass-card p-5">
            <h3 className="mb-2 font-heading text-h3 font-semibold text-neutral-950">Roles & Skills</h3>
            <div className="space-y-3">
              <div>
                <p className="text-caption uppercase tracking-wide text-neutral-500">Roles</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {person.roles.length === 0 ? (
                    <span className="text-small text-neutral-400">None</span>
                  ) : (
                    person.roles.map((r) => (
                      <span key={r} className="rounded-full bg-primary-100 px-2 py-0.5 text-caption text-primary-700">{r}</span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-caption uppercase tracking-wide text-neutral-500">Skills</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {person.skills.length === 0 ? (
                    <span className="text-small text-neutral-400">None</span>
                  ) : (
                    person.skills.map((s) => (
                      <span key={s} className="rounded-full bg-neutral-200 px-2 py-0.5 text-caption text-neutral-700">{s}</span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-caption uppercase tracking-wide text-neutral-500">Capacity</p>
                <p className="mt-1 text-body-medium font-medium text-neutral-950">{person.availableHoursPerWeek} hrs/wk</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button href="/team" variant="secondary">Back to Team</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-caption text-neutral-500">{label}</p>
        <p className="truncate text-body-medium font-medium text-neutral-950">{value}</p>
      </div>
    </div>
  );
}

const ICON_BADGE = "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6";
const ICON_JOB = "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0h2a2 2 0 012 2v6M8 6H6a2 2 0 00-2 2v6";
const ICON_TASKS = "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4";
const ICON_CAL = "M8 7V3M16 7V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z";
