import { type BadgeColor } from "@/components/ui/Badge";

// Hex values mirror app/globals.css's --{color}-600 tokens — conic-gradient
// can't consume Tailwind classes or CSS vars scoped to other elements, so
// the values are duplicated here once rather than re-read per render.
const HEX: Record<BadgeColor, string> = {
  neutral: "#9ca0a8",
  info: "#2e7bb0",
  warning: "#b4740e",
  danger: "#c13b3b",
  success: "#1c8a5a",
  ai: "#7a4fd6",
};

const DOT_CLASSES: Record<BadgeColor, string> = {
  neutral: "bg-neutral-400",
  info: "bg-info-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  success: "bg-success-600",
  ai: "bg-ai-600",
};

// Native conic-gradient — a 6-slice donut doesn't earn a charting
// dependency any more than the bar chart did.
export function DonutChart({
  slices,
  centerLabel,
  centerSublabel = "tasks",
}: {
  slices: { label: string; value: number; color: BadgeColor }[];
  centerLabel?: string;
  centerSublabel?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  let cursor = 0;
  const stops = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (cursor / total) * 360;
      cursor += s.value;
      const end = (cursor / total) * 360;
      return `${HEX[s.color]} ${start}deg ${end}deg`;
    });

  // DESIGN_SYSTEM.md §6: no default Tailwind palette values — the empty
  // state used to fall back to Tailwind's gray-200 (#e5e7eb) instead of
  // the design system's own neutral-200 token.
  const gradient = total === 0 ? "var(--neutral-200)" : stops.join(", ");

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div
        className="relative h-44 w-44 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-neutral-50">
          <span className="text-h1 font-semibold text-neutral-950">{centerLabel ?? total}</span>
          <span className="text-caption text-neutral-600">{centerSublabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-1">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASSES[s.color]}`} />
            <span className="text-small text-neutral-600">{s.label}</span>
            <span className="text-small font-medium text-neutral-950">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
