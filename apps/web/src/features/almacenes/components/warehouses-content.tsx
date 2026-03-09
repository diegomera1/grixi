"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Warehouse,
  MapPin,
  Layers,
  Thermometer,
  Box,
  TrendingUp,
  ArrowRight,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useMemo } from "react";

type WarehouseData = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  is_active: boolean;
  rackCount: number;
  totalPositions: number;
  occupiedPositions: number;
  occupancy: number;
};

type WarehousesContentProps = {
  warehouses: WarehouseData[];
};

const typeConfig: Record<
  string,
  { label: string; icon: typeof Warehouse; gradient: string; bg: string; color: string }
> = {
  standard: {
    label: "Estándar",
    icon: Warehouse,
    gradient: "from-indigo-500 to-blue-600",
    bg: "bg-indigo-500/8",
    color: "text-indigo-600 dark:text-indigo-400",
  },
  cross_docking: {
    label: "Cross-Docking",
    icon: Layers,
    gradient: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/8",
    color: "text-amber-600 dark:text-amber-400",
  },
  cold_storage: {
    label: "Cámara Fría",
    icon: Thermometer,
    gradient: "from-cyan-500 to-blue-600",
    bg: "bg-cyan-500/8",
    color: "text-cyan-600 dark:text-cyan-400",
  },
};

function OccupancyRing({
  value,
  size = 72,
  strokeWidth = 5,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value > 85 ? "#EF4444" : value > 60 ? "#F59E0B" : "#10B981";

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WarehousesContent({ warehouses }: WarehousesContentProps) {
  // Aggregate KPIs across all warehouses
  const kpis = useMemo(() => {
    const totalRacks = warehouses.reduce((s, w) => s + w.rackCount, 0);
    const totalPositions = warehouses.reduce((s, w) => s + w.totalPositions, 0);
    const totalOccupied = warehouses.reduce(
      (s, w) => s + w.occupiedPositions,
      0
    );
    const avgOccupancy =
      totalPositions > 0
        ? Math.round((totalOccupied / totalPositions) * 100)
        : 0;
    const activeCount = warehouses.filter((w) => w.is_active).length;
    return { totalRacks, totalPositions, totalOccupied, avgOccupancy, activeCount };
  }, [warehouses]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* ── Hero Header ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-muted)]"
      >
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)]/10">
                  <Warehouse size={20} className="text-[var(--brand)]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    Almacenes
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Gestión y monitoreo en tiempo real
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {kpis.activeCount} activos
              </span>
            </div>
          </div>

          {/* ── Aggregate KPI cards ────────── */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Total Racks",
                value: kpis.totalRacks,
                icon: BarChart3,
                color: "text-indigo-500",
                bg: "bg-indigo-500/8",
              },
              {
                label: "Posiciones",
                value: kpis.totalPositions.toLocaleString(),
                icon: Box,
                color: "text-blue-500",
                bg: "bg-blue-500/8",
              },
              {
                label: "Ocupadas",
                value: kpis.totalOccupied.toLocaleString(),
                icon: CheckCircle2,
                color: "text-emerald-500",
                bg: "bg-emerald-500/8",
              },
              {
                label: "Ocupación Promedio",
                value: `${kpis.avgOccupancy}%`,
                icon: TrendingUp,
                color:
                  kpis.avgOccupancy > 85
                    ? "text-red-500"
                    : kpis.avgOccupancy > 60
                    ? "text-amber-500"
                    : "text-emerald-500",
                bg:
                  kpis.avgOccupancy > 85
                    ? "bg-red-500/8"
                    : kpis.avgOccupancy > 60
                    ? "bg-amber-500/8"
                    : "bg-emerald-500/8",
              },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    kpi.bg
                  )}
                >
                  <kpi.icon size={16} className={kpi.color} />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                    {kpi.value}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-muted)]">
                    {kpi.label}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Warehouse Cards Grid ────────────────── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {warehouses.map((warehouse, index) => {
          const cfg = typeConfig[warehouse.type] || typeConfig.standard;
          const TypeIcon = cfg.icon;
          const emptyPositions =
            warehouse.totalPositions - warehouse.occupiedPositions;
          const healthStatus =
            warehouse.occupancy > 90
              ? { label: "Crítico", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle }
              : warehouse.occupancy > 70
              ? { label: "Alto", color: "text-amber-500", bg: "bg-amber-500/10", icon: Activity }
              : { label: "Óptimo", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 };
          const HealthIcon = healthStatus.icon;

          return (
            <motion.div
              key={warehouse.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.08, duration: 0.4 }}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] card-elevated"
            >
              {/* Top gradient accent */}
              <div
                className={cn(
                  "h-1 w-full bg-gradient-to-r",
                  cfg.gradient
                )}
              />

              <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        cfg.bg
                      )}
                    >
                      <TypeIcon size={20} className={cfg.color} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                        {warehouse.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                            cfg.bg,
                            cfg.color
                          )}
                        >
                          {cfg.label}
                        </span>
                        {warehouse.location && (
                          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                            <MapPin size={10} />
                            {warehouse.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-1",
                      healthStatus.bg
                    )}
                  >
                    <HealthIcon size={11} className={healthStatus.color} />
                    <span
                      className={cn(
                        "text-[9px] font-bold",
                        healthStatus.color
                      )}
                    >
                      {healthStatus.label}
                    </span>
                  </div>
                </div>

                {/* Occupancy section */}
                <div className="mt-5 flex items-center gap-5">
                  {/* Ring chart */}
                  <div className="relative flex-shrink-0">
                    <OccupancyRing value={warehouse.occupancy} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-black tabular-nums text-[var(--text-primary)] leading-none">
                        {warehouse.occupancy}
                      </span>
                      <span className="text-[8px] font-medium text-[var(--text-muted)]">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {[
                      { label: "Racks", value: warehouse.rackCount, color: "text-indigo-500" },
                      { label: "Total Pos.", value: warehouse.totalPositions, color: "text-blue-500" },
                      { label: "Ocupadas", value: warehouse.occupiedPositions, color: "text-emerald-500" },
                      { label: "Disponibles", value: emptyPositions, color: "text-slate-500" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-center"
                      >
                        <p
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            stat.color
                          )}
                        >
                          {stat.value}
                        </p>
                        <p className="text-[9px] font-medium text-[var(--text-muted)]">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Occupancy bar */}
                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${warehouse.occupancy}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.3 + index * 0.08 }}
                      style={{
                        backgroundColor:
                          warehouse.occupancy > 85
                            ? "#EF4444"
                            : warehouse.occupancy > 60
                            ? "#F59E0B"
                            : "#10B981",
                      }}
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-5 flex gap-2">
                  <Link
                    href={`/almacenes/${warehouse.id}`}
                    className="group/btn flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-hover)] hover:bg-[var(--bg-muted)]"
                  >
                    <Eye size={14} />
                    Vista 2D
                  </Link>
                  <Link
                    href={`/almacenes/${warehouse.id}?view=3d`}
                    className="group/btn flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-[var(--brand)]/25"
                  >
                    <Box size={14} />
                    Vista 3D
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover/btn:translate-x-0.5"
                    />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
