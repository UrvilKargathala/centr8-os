"use client";

type WeekData = {
  weekStart: string;
  plannedHours: number;
  leaveHours: number;
  availableHours: number;
  utilizationPercent: number;
};

type PersonRow = {
  personId: string;
  personName: string;
  role: string | null;
  department: string | null;
  weeks: WeekData[];
};

function cellStyle(pct: number) {
  if (pct > 100) return "bg-danger-100 text-danger-600";
  if (pct >= 76) return "bg-success-100 text-success-600";
  if (pct >= 51) return "bg-warning-100 text-warning-600";
  if (pct > 0) return "bg-ai-100 text-neutral-600";
  return "bg-neutral-100 text-neutral-400";
}

function formatWeek(ws: string) {
  const d = new Date(ws);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function UtilizationLegend() {
  const tiers = [
    { label: "> 100%", cls: "bg-danger-100 text-danger-600" },
    { label: "76-100%", cls: "bg-success-100 text-success-600" },
    { label: "51-75%", cls: "bg-warning-100 text-warning-600" },
    { label: "1-50%", cls: "bg-ai-100 text-neutral-600" },
    { label: "0%", cls: "bg-neutral-100 text-neutral-400" },
  ];
  return (
    <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500">
      {tiers.map((t) => (
        <span key={t.label} className="flex items-center gap-1">
          <span className={`inline-block h-2.5 w-4 rounded ${t.cls}`} />
          {t.label}
        </span>
      ))}
    </div>
  );
}

export function UtilizationHeatmap({
  data,
  compact,
}: {
  data: PersonRow[];
  compact?: boolean;
}) {
  if (!data.length) return null;
  const weeks = data[0]?.weeks ?? [];

  return (
    <div className="glass-table overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 font-medium text-neutral-600">Name</th>
            {!compact && <th className="px-3 py-2 font-medium text-neutral-600">Role</th>}
            {!compact && <th className="px-3 py-2 font-medium text-neutral-600">Dept</th>}
            {weeks.map((w) => (
              <th key={w.weekStart} className="px-2 py-2 text-center font-medium text-neutral-600 whitespace-nowrap">
                {formatWeek(w.weekStart)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.personId} className="border-b border-neutral-100 hover:bg-neutral-50/50">
              <td className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 font-medium text-neutral-800 whitespace-nowrap">
                {p.personName}
              </td>
              {!compact && <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{p.role ?? "—"}</td>}
              {!compact && <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{p.department ?? "—"}</td>}
              {p.weeks.map((w) => (
                <td key={w.weekStart} className="px-1 py-1 text-center">
                  <span
                    className={`inline-block min-w-[2.5rem] rounded px-1.5 py-0.5 font-heading text-[12px] font-medium ${cellStyle(w.utilizationPercent)}`}
                    title={`${w.plannedHours}h planned / ${w.availableHours}h available${w.leaveHours > 0 ? ` (${w.leaveHours}h leave)` : ""}`}
                  >
                    {w.utilizationPercent}%
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
