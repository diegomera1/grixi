import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  staggerIndex?: number;
}

export function KpiCard({ label, value, icon: Icon, color, staggerIndex = 0 }: KpiCardProps) {
  return (
    <div
      className={`enter-fade stagger-${staggerIndex + 1} card-elevated flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4`}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in oklch, ${color} 12%, transparent)` }}
      >
        <Icon size={20} style={{ color }} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-[var(--text-muted)] truncate">{label}</p>
      </div>
    </div>
  );
}
