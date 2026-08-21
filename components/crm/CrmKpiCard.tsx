import { cn } from "@/lib/utils";

const COLORS = {
  primary: {
    bg: "bg-primary-100/40",
    border: "border-primary-600/20",
    iconBg: "bg-primary-100",
    iconText: "text-primary-700",
  },
  success: {
    bg: "bg-success-100/40",
    border: "border-success-600/20",
    iconBg: "bg-success-100",
    iconText: "text-success-600",
  },
  danger: {
    bg: "bg-danger-100/40",
    border: "border-danger-600/20",
    iconBg: "bg-danger-100",
    iconText: "text-danger-600",
  },
  warning: {
    bg: "bg-warning-100/40",
    border: "border-warning-600/20",
    iconBg: "bg-warning-100",
    iconText: "text-warning-600",
  },
  info: {
    bg: "bg-info-100/40",
    border: "border-info-600/20",
    iconBg: "bg-info-100",
    iconText: "text-info-600",
  },
  neutral: {
    bg: "bg-neutral-100/30",
    border: "border-neutral-300/30",
    iconBg: "bg-neutral-100",
    iconText: "text-neutral-500",
  },
} as const;

type KpiColor = keyof typeof COLORS;

export function CrmKpiCard({
  label,
  value,
  color = "neutral",
  icon,
  subtitle,
  className,
  children,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  color?: KpiColor;
  icon?: React.ReactNode;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const c = COLORS[color];
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 text-left backdrop-blur-sm transition-shadow",
        c.bg,
        c.border,
        onClick && "cursor-pointer hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-caption font-medium text-neutral-500">{label}</p>
        {icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", c.iconBg, c.iconText)}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-h2 font-bold tracking-tight text-neutral-950">{value}</p>
      {subtitle && <p className="mt-0.5 text-small text-neutral-500">{subtitle}</p>}
      {children}
    </Wrapper>
  );
}

// Shared icon library — each a 20x20 SVG, stroke-based
const I = (d: string) => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const KpiIcons = {
  users: I("M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"),
  userPlus: I("M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M8.5 7a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6"),
  target: I("M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z"),
  trendUp: I("M23 6l-9.5 9.5-5-5L1 18"),
  percent: I("M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"),
  building: I("M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"),
  briefcase: I("M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"),
  handshake: I("M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"),
  star: I("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"),
  lightning: I("M13 2L3 14h9l-1 10 10-12h-9l1-10z"),
  calendar: I("M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18"),
  activity: I("M22 12h-4l-3 9L9 3l-3 9H2"),
  dollarSign: I("M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"),
  barChart: I("M12 20V10M18 20V4M6 20v-4"),
  pieChart: I("M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"),
  filter: I("M22 3H2l8 9.46V19l4 2v-8.54L22 3z"),
  award: I("M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12"),
  mail: I("M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6"),
  megaphone: I("M3 11l18-5v12L3 13v-2zM11.6 16.8a3 3 0 11-5.8-1.6"),
  clock: I("M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2"),
  checkCircle: I("M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"),
  flag: I("M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"),
  link: I("M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"),
  layers: I("M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"),
  zap: I("M13 2L3 14h9l-1 10 10-12h-9l1-10z"),
  compass: I("M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"),
};
