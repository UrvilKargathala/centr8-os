// Same shape used on /projects and the PM dashboard — title top-left,
// up-right arrow, big number bottom-left, decorative dot grid bottom-right
// (one filled cell per `pattern` unit, tone-colored). No fabricated growth-%
// badge — same rule the existing StatCard uses (no historical snapshots).
export function KpiCard({
  title,
  value,
  pattern,
  tone,
  trend,
}: {
  title: string;
  value: number | string;
  pattern: number;
  tone: "neutral" | "success" | "info" | "danger" | "warning" | "primary";
  // Optional footer text rendered inside the card (e.g. "+6 this week")
  trend?: { text: string; positive?: boolean };
}) {
  const dotClass = {
    neutral: "bg-neutral-400",
    success: "bg-success-600",
    info: "bg-info-600",
    danger: "bg-danger-600",
    warning: "bg-warning-600",
    primary: "bg-primary-600",
  }[tone];
  const dots = Math.min(24, Math.max(0, pattern));
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-md border border-neutral-300 bg-neutral-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-small text-neutral-600">{title}</p>
        <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H8M17 7v9" />
        </svg>
      </div>
      <div className="mt-6 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-display font-semibold text-neutral-950">{value}</p>
          {trend && (
            <p className={`mt-0.5 text-caption ${trend.positive ? "text-success-600" : "text-neutral-500"}`}>
              {trend.text}
            </p>
          )}
        </div>
        <div className="grid grid-cols-6 gap-0.5">
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-sm ${i < dots ? dotClass : "bg-neutral-200"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
