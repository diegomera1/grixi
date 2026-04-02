/**
 * Page Skeleton — Loading states for routes
 * 
 * Usage: export function HydrateFallback() { return <PageSkeleton variant="dashboard" />; }
 */

interface PageSkeletonProps {
  variant?: "dashboard" | "table" | "settings" | "detail" | "chat";
}

function Pulse({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ backgroundColor: "var(--muted-foreground)", opacity: 0.08, ...style }}
    />
  );
}

export function PageSkeleton({ variant = "dashboard" }: PageSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className="animate-in fade-in duration-300 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Pulse className="h-7 w-48" />
            <Pulse className="h-4 w-32" />
          </div>
          <Pulse className="h-10 w-10 rounded-full" />
        </div>
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
              <Pulse className="h-3 w-20" />
              <Pulse className="h-8 w-16" />
              <Pulse className="h-2 w-24" />
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)" }}>
          <Pulse className="h-4 w-40 mb-4" />
          <Pulse style={{ height: "200px" }} />
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="animate-in fade-in duration-300 space-y-4">
        <div className="flex items-center justify-between">
          <Pulse className="h-7 w-48" />
          <Pulse className="h-9 w-32 rounded-lg" />
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {/* Header row */}
          <div className="flex gap-4 p-4 border-b" style={{ borderColor: "var(--border)" }}>
            {[120, 80, 100, 60].map((w, i) => (
              <Pulse key={i} className="h-3" style={{ width: `${w}px` }} />
            ))}
          </div>
          {/* Body rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 p-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              {[120, 80, 100, 60].map((w, j) => (
                <Pulse key={j} className="h-4" style={{ width: `${w + Math.random() * 40}px` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "settings") {
    return (
      <div className="animate-in fade-in duration-300 space-y-6 max-w-2xl">
        <Pulse className="h-7 w-48 mb-2" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--border)" }}>
            <Pulse className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Pulse className="h-3 w-24" />
                <Pulse className="h-10 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Pulse className="h-3 w-24" />
                <Pulse className="h-10 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "chat") {
    return (
      <div className="animate-in fade-in duration-300 flex flex-col h-[calc(100vh-120px)]">
        <Pulse className="h-7 w-40 mb-4" />
        <div className="flex-1 space-y-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
              <div className="space-y-2" style={{ maxWidth: "70%" }}>
                <Pulse className="h-4" style={{ width: `${150 + i * 50}px` }} />
                <Pulse className="h-4" style={{ width: `${100 + i * 30}px` }} />
              </div>
            </div>
          ))}
        </div>
        <Pulse className="h-12 rounded-xl mt-4" />
      </div>
    );
  }

  // detail
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex items-center gap-4">
        <Pulse className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Pulse className="h-6 w-48" />
          <Pulse className="h-3 w-32" />
        </div>
      </div>
      <div className="rounded-xl border p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
