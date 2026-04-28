import { useEffect, useState, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  staggerIndex?: number;
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startRef.current = null;

    const step = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return count;
}

export function KpiCard({ label, value, icon: Icon, color, staggerIndex = 0 }: KpiCardProps) {
  const displayValue = useCountUp(value, 900 + staggerIndex * 100);

  return (
    <div
      className={`enter-fade stagger-${staggerIndex + 1} group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-all duration-300 hover:border-border-hover hover:shadow-md`}
      style={{
        // Subtle gradient on hover via CSS
        background: `linear-gradient(135deg, var(--bg-surface) 0%, color-mix(in oklch, ${color} 3%, var(--bg-surface)) 100%)`,
      }}
    >
      {/* Decorative glow on hover */}
      <div
        className="absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ backgroundColor: color }}
      />

      <div className="relative flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
          style={{
            background: `color-mix(in oklch, ${color} 12%, transparent)`,
            boxShadow: `0 0 0 0 ${color}00`,
          }}
        >
          <Icon size={19} style={{ color }} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums text-text-primary tracking-tight">
            {displayValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-text-muted truncate leading-tight">{label}</p>
        </div>
      </div>
    </div>
  );
}
