"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Person } from "../page";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Static month-grid heatmap sized to the current month. Since there's no
// per-person activity time-series yet (tasks/audit-log carry no linked
// people.id), the cells render at zero intensity — the layout ships so
// the shape is correct the moment we start writing per-person events.
type Contribution = { iso: string; day: number; count: number };
function buildMonthGrid(reference = new Date()): {
  label: string;
  cells: (Contribution | null)[];
  total: number;
} {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = first.getDay();
  const cells: (Contribution | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { iso, day, count: 0 };
    }),
  ];
  return {
    label: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    cells,
    total: 0,
  };
}

const HEAT_TONES = ["bg-neutral-100", "bg-success-100", "bg-success-600", "bg-success-600"];

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/team/${id}`)
      .then((r) => r.json())
      .then((b) => {
        if (b.data) setPerson(b.data);
        else setError(b.error ?? "Person not found");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  const grid = useMemo(() => buildMonthGrid(), []);

  if (loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (error || !person) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error ?? "Not found"}</p>;

  const joined = new Date(person.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });

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
        {/* ── LEFT COLUMN ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-5">
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
              <Fact icon={ICON_BADGE} label="Department" value={person.department ?? "—"} />
              <Fact icon={ICON_PIN} label="Location" value="—" hint="Add via HR profile" />
              <Fact icon={ICON_PHONE} label="Phone" value="—" hint="Add via HR profile" />
              <Fact icon={ICON_CAL} label="Joined" value={joined} />
            </div>
          </div>

          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-h3 font-semibold text-neutral-950">Recent Activity</h3>
              {!person.isActive && <Badge color="neutral">Inactive</Badge>}
            </div>
            <p className="text-body text-neutral-600">
              No activity yet — this timeline shows tasks completed, files uploaded, and status changes once
              this person is assigned to work.
            </p>
            <Link href={`/team`} className="mt-3 inline-block text-small font-medium text-primary-700 hover:underline">
              Back to Team
            </Link>
          </div>
        </div>

        {/* ── RIGHT COLUMN ───────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-h3 font-semibold text-neutral-950">Time-Based Activity Map</h3>
              <span className="rounded-md border border-neutral-300 px-2 py-1 text-caption text-neutral-700">
                {grid.label}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="text-center text-caption text-neutral-500">
                  {d}
                </span>
              ))}
              {grid.cells.map((c, i) => {
                if (!c) return <div key={i} className="h-6 w-full" />;
                const bucket = c.count === 0 ? 0 : c.count < 3 ? 1 : c.count < 6 ? 2 : 3;
                return (
                  <div
                    key={i}
                    className={`h-6 w-full rounded-sm ${HEAT_TONES[bucket]}`}
                    title={`${c.iso}: ${c.count} contribution${c.count === 1 ? "" : "s"}`}
                  />
                );
              })}
            </div>
            <p className="mt-3 text-center text-small text-neutral-600">
              {grid.total} contributions in {grid.label}
            </p>
          </div>

          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-5">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">Task Performance</h3>
            <div className="mt-4 flex h-40 items-end gap-2">
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((m) => (
                <div key={m} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end">
                    <div className="w-full rounded-t-sm bg-neutral-200" style={{ height: "4%" }} />
                  </div>
                  <span className="text-caption text-neutral-500">{m}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-small text-neutral-600">
              No task history yet — populates once assignments start being tracked against this member.
            </p>
          </div>

          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-5">
            <h3 className="mb-2 font-heading text-h3 font-semibold text-neutral-950">Roles & Skills</h3>
            <div className="space-y-3">
              <div>
                <p className="text-caption uppercase tracking-wide text-neutral-500">Roles</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {person.roles.length === 0 ? (
                    <span className="text-small text-neutral-400">None</span>
                  ) : (
                    person.roles.map((r) => (
                      <span key={r} className="rounded-full bg-primary-100 px-2 py-0.5 text-caption text-primary-700">
                        {r}
                      </span>
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
                      <span key={s} className="rounded-full bg-neutral-200 px-2 py-0.5 text-caption text-neutral-700">
                        {s}
                      </span>
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
            <Button href={`/team`} variant="secondary">
              Back to Team
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
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
        {hint && <p className="text-caption text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
}

const ICON_BADGE =
  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6";
const ICON_PIN = "M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11zm0-8a3 3 0 100-6 3 3 0 000 6z";
const ICON_PHONE =
  "M3 5a2 2 0 012-2h3.28a1 1 0 011 .76l1.12 4.49a1 1 0 01-.29.95l-1.6 1.6a11.04 11.04 0 005.53 5.53l1.6-1.6a1 1 0 01.95-.29l4.49 1.12a1 1 0 01.76 1V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z";
const ICON_CAL = "M8 7V3M16 7V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z";
