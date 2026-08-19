import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-neutral-200/70", className)}
      {...props}
    />
  );
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card rounded-md p-5", className)}>
      <Skeleton className="mb-3 h-5 w-1/3" />
      <SkeletonText lines={2} />
    </div>
  );
}

function SkeletonKPI({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card rounded-xl p-4", className)}>
      <Skeleton className="mb-2 h-4 w-20" />
      <Skeleton className="mb-1 h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3">
      {Array.from({ length: cols }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === 0 ? "w-32" : "w-20")} />
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("glass-table overflow-hidden", className)}>
      <div className="flex items-center gap-4 border-b border-neutral-200 bg-neutral-100/50 px-4 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "w-24" : "w-16")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </div>
  );
}

function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return <Skeleton className={cn("shrink-0 rounded-full", s)} />;
}

function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
      <SkeletonAvatar size="sm" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

function PageSkeleton({ variant }: { variant: "dashboard" | "table" | "detail" | "cards" | "form" | "chat" | "kanban" }) {
  switch (variant) {
    case "dashboard":
      return (
        <div className="space-y-6">
          <div className="space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SkeletonKPI /><SkeletonKPI /><SkeletonKPI /><SkeletonKPI />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SkeletonCard className="min-h-[200px]" />
            <SkeletonCard className="min-h-[200px]" />
          </div>
          <SkeletonCard className="min-h-[120px]" />
        </div>
      );
    case "table":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SkeletonKPI /><SkeletonKPI /><SkeletonKPI /><SkeletonKPI />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <SkeletonTable rows={6} cols={6} />
        </div>
      );
    case "detail":
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <SkeletonCard className="min-h-[180px]" />
              <SkeletonCard className="min-h-[160px]" />
            </div>
            <div className="space-y-4">
              <SkeletonCard className="min-h-[180px]" />
              <SkeletonCard className="min-h-[160px]" />
            </div>
          </div>
        </div>
      );
    case "cards":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard className="min-h-[140px]" />
            <SkeletonCard className="min-h-[140px]" />
            <SkeletonCard className="min-h-[140px]" />
            <SkeletonCard className="min-h-[140px]" />
            <SkeletonCard className="min-h-[140px]" />
            <SkeletonCard className="min-h-[140px]" />
          </div>
        </div>
      );
    case "form":
      return (
        <div className="space-y-6">
          <div className="space-y-1">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <SkeletonCard className="min-h-[200px]" />
          <SkeletonCard className="min-h-[160px]" />
          <SkeletonCard className="min-h-[120px]" />
        </div>
      );
    case "chat":
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-3">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={cn("flex gap-3", i % 2 ? "justify-end" : "")}>
                {i % 2 === 0 && <SkeletonAvatar size="sm" />}
                <Skeleton className={cn("h-12 rounded-lg", i % 2 ? "w-2/5" : "w-3/5")} />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      );
    case "kanban":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-md" />
              <Skeleton className="h-9 w-20 rounded-md" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }, (_, col) => (
              <div key={col} className="w-64 shrink-0 space-y-3">
                <Skeleton className="h-5 w-24" />
                {Array.from({ length: 3 - col % 2 }, (_, row) => (
                  <Skeleton key={row} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        </div>
      );
  }
}

function SectionSkeleton({ variant }: { variant: "table" | "list" | "cards" | "text" }) {
  switch (variant) {
    case "table":
      return <SkeletonTable rows={4} cols={5} />;
    case "list":
      return (
        <div className="glass-table overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => <SkeletonListItem key={i} />)}
        </div>
      );
    case "cards":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      );
    case "text":
      return <SkeletonText lines={4} />;
  }
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonKPI,
  SkeletonTable,
  SkeletonTableRow,
  SkeletonAvatar,
  SkeletonListItem,
  PageSkeleton,
  SectionSkeleton,
};
