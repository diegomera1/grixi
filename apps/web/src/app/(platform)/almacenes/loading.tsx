// Skeleton loading state for the Almacenes (WMS) page

// ── Skeleton pulse component ────────────────────
function KpiSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 animate-pulse">
      <div className="h-9 w-9 rounded-lg bg-muted" />
      <div className="space-y-1.5">
        <div className="h-5 w-12 rounded bg-muted" />
        <div className="h-2.5 w-16 rounded bg-muted" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <div className="h-3.5 w-40 rounded bg-muted" />
          <div className="h-2.5 w-56 rounded bg-muted" />
        </div>
        <div className="flex gap-3">
          <div className="h-2.5 w-14 rounded bg-muted" />
          <div className="h-2.5 w-14 rounded bg-muted" />
          <div className="h-2.5 w-14 rounded bg-muted" />
        </div>
      </div>
      {/* Chart area shimmer */}
      <div className="h-[220px] rounded-lg bg-muted/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3.5 w-28 rounded bg-muted" />
        <div className="h-5 w-12 rounded-full bg-muted" />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-muted/20">
            <div className="w-7 h-7 rounded-md bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-2 w-1/2 rounded bg-muted" />
            </div>
            <div className="space-y-1.5 text-right">
              <div className="h-2.5 w-12 rounded bg-muted" />
              <div className="h-2 w-8 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WarehouseCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="h-2 w-24 rounded bg-muted" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
        <div className="flex-1 grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
              <div className="h-3.5 w-8 rounded bg-muted mx-auto mb-1" />
              <div className="h-2 w-10 rounded bg-muted mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-40 rounded bg-muted" />
            <div className="h-4 w-14 rounded-full bg-muted" />
          </div>
          <div className="h-2.5 w-full rounded bg-muted" />
          <div className="h-2.5 w-3/4 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function AlmacenesLoading() {
  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[var(--bg-base)] p-4 md:p-6">
      {/* ── Header ──────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 rounded bg-muted animate-pulse" />
            <div className="h-3 w-64 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
      </div>

      {/* ── Tabs skeleton ────────────── */}
      <div className="flex gap-1 mb-6 border-b border-border pb-2">
        {["Dashboard", "Almacenes", "Operaciones", "Pedidos", "Inventario", "Movimientos"].map(
          (tab) => (
            <div key={tab} className="px-4 py-2 rounded-lg">
              <div className="h-3 rounded bg-muted animate-pulse" style={{ width: `${tab.length * 8}px` }} />
            </div>
          )
        )}
      </div>

      {/* ── KPI Row ─────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>

      {/* ── Chart + Activity ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3">
          <ChartSkeleton />
        </div>
        <div className="lg:col-span-2">
          <ActivitySkeleton />
        </div>
      </div>

      {/* ── Warehouse Cards ──────── */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-36 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <WarehouseCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* ── AI Insights ─────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-16 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <InsightSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
