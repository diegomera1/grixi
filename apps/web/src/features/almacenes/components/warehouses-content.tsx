"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Package,
  Grid3x3,
  LayoutDashboard,
  List,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

// ─── Tab Config ─────────────────────────────────────────
type AlmacenesTab = "resumen" | "almacenes" | "inventario";

const TABS: { id: AlmacenesTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "almacenes", label: "Almacenes", icon: Warehouse },
  { id: "inventario", label: "Inventario", icon: Package },
];

// ─── Type Config ────────────────────────────────────────
const typeConfig: Record<
  string,
  { label: string; icon: typeof Warehouse; gradient: string; bg: string; color: string; accentHex: string }
> = {
  standard: {
    label: "Estándar",
    icon: Warehouse,
    gradient: "from-indigo-500 to-blue-600",
    bg: "bg-indigo-500/8",
    color: "text-indigo-600 dark:text-indigo-400",
    accentHex: "#6366F1",
  },
  cross_docking: {
    label: "Cross-Docking",
    icon: Layers,
    gradient: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/8",
    color: "text-amber-600 dark:text-amber-400",
    accentHex: "#F59E0B",
  },
  cold_storage: {
    label: "Cámara Fría",
    icon: Thermometer,
    gradient: "from-cyan-500 to-blue-600",
    bg: "bg-cyan-500/8",
    color: "text-cyan-600 dark:text-cyan-400",
    accentHex: "#06B6D4",
  },
};

// ─── Occupancy Ring ─────────────────────────────────────
function OccupancyRing({
  value,
  size = 80,
  strokeWidth = 6,
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

// ─── Main Component ─────────────────────────────────────
export function WarehousesContent({ warehouses }: WarehousesContentProps) {
  const [activeTab, setActiveTab] = useState<AlmacenesTab>(() => {
    if (typeof window !== "undefined") {
      return (sessionStorage.getItem("almacenes-active-tab") as AlmacenesTab) || "resumen";
    }
    return "resumen";
  });

  // Persist active tab for back navigation
  useEffect(() => {
    sessionStorage.setItem("almacenes-active-tab", activeTab);
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredWarehouse, setHoveredWarehouse] = useState<string | null>(null);

  // Aggregate KPIs across all warehouses
  const kpis = useMemo(() => {
    const totalRacks = warehouses.reduce((s, w) => s + w.rackCount, 0);
    const totalPositions = warehouses.reduce((s, w) => s + w.totalPositions, 0);
    const totalOccupied = warehouses.reduce((s, w) => s + w.occupiedPositions, 0);
    const avgOccupancy = totalPositions > 0 ? Math.round((totalOccupied / totalPositions) * 100) : 0;
    const activeCount = warehouses.filter((w) => w.is_active).length;
    const criticalCount = warehouses.filter(w => w.occupancy > 90).length;
    const totalAvailable = totalPositions - totalOccupied;
    return { totalRacks, totalPositions, totalOccupied, avgOccupancy, activeCount, criticalCount, totalAvailable };
  }, [warehouses]);

  const filteredWarehouses = useMemo(() => {
    if (!searchQuery) return warehouses;
    return warehouses.filter(w =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.location && w.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [warehouses, searchQuery]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-0">
      {/* ── Header + Tabs ────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)]/10">
              <Warehouse size={20} className="text-[var(--brand)]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Almacenes</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Gestión y monitoreo en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.activeCount} activos
            </span>
          </div>
        </div>

        {/* Tab Navigation — same pattern as finanzas */}
        <div className="grid grid-cols-3 border-b border-[var(--border)] sm:flex sm:items-center sm:gap-1 sm:-mx-1 sm:px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all relative",
                "sm:justify-start sm:px-4",
                activeTab === tab.id
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="almacenes-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand)] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === "resumen" && (
          <motion.div key="resumen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Almacenes", value: warehouses.length, icon: Warehouse, color: "text-violet-500", bg: "bg-violet-500/8" },
                { label: "Total Racks", value: kpis.totalRacks.toLocaleString(), icon: Grid3x3, color: "text-indigo-500", bg: "bg-indigo-500/8" },
                { label: "Posiciones", value: kpis.totalPositions.toLocaleString(), icon: Package, color: "text-blue-500", bg: "bg-blue-500/8" },
                { label: "Ocupadas", value: kpis.totalOccupied.toLocaleString(), icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/8" },
                { label: "Disponibles", value: kpis.totalAvailable.toLocaleString(), icon: Box, color: "text-slate-500", bg: "bg-slate-500/8" },
                { label: "Ocupación", value: `${kpis.avgOccupancy}%`, icon: TrendingUp,
                  color: kpis.avgOccupancy > 85 ? "text-red-500" : kpis.avgOccupancy > 60 ? "text-amber-500" : "text-emerald-500",
                  bg: kpis.avgOccupancy > 85 ? "bg-red-500/8" : kpis.avgOccupancy > 60 ? "bg-amber-500/8" : "bg-emerald-500/8",
                },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3"
                >
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", kpi.bg)}>
                    <kpi.icon size={16} className={kpi.color} />
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
                    <p className="text-[10px] font-medium text-[var(--text-muted)]">{kpi.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick overview with hover details */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {warehouses.map((warehouse, index) => {
                const cfg = typeConfig[warehouse.type] || typeConfig.standard;
                const TypeIcon = cfg.icon;
                const emptyPositions = warehouse.totalPositions - warehouse.occupiedPositions;
                const healthStatus =
                  warehouse.occupancy > 90
                    ? { label: "Crítico", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle }
                    : warehouse.occupancy > 70
                    ? { label: "Alto", color: "text-amber-500", bg: "bg-amber-500/10", icon: Activity }
                    : { label: "Óptimo", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 };
                const HealthIcon = healthStatus.icon;
                const isHovered = hoveredWarehouse === warehouse.id;

                return (
                  <motion.div
                    key={warehouse.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.06, duration: 0.35 }}
                    onMouseEnter={() => setHoveredWarehouse(warehouse.id)}
                    onMouseLeave={() => setHoveredWarehouse(null)}
                    className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] transition-shadow hover:shadow-lg hover:shadow-black/5"
                  >
                    {/* Top gradient */}
                    <div className={cn("h-1 w-full bg-gradient-to-r", cfg.gradient)} />
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", cfg.bg)}>
                            <TypeIcon size={20} className={cfg.color} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                              {warehouse.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", cfg.bg, cfg.color)}>
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
                        <div className={cn("flex items-center gap-1 rounded-full px-2 py-1", healthStatus.bg)}>
                          <HealthIcon size={11} className={healthStatus.color} />
                          <span className={cn("text-[9px] font-bold", healthStatus.color)}>{healthStatus.label}</span>
                        </div>
                      </div>

                      {/* Occupancy */}
                      <div className="mt-5 flex items-center gap-5">
                        <div className="relative flex-shrink-0">
                          <OccupancyRing value={warehouse.occupancy} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black tabular-nums text-[var(--text-primary)] leading-none">
                              {warehouse.occupancy}
                            </span>
                            <span className="text-[9px] font-medium text-[var(--text-muted)]">%</span>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-2">
                          {[
                            { label: "Racks", value: warehouse.rackCount, color: "text-indigo-500" },
                            { label: "Posiciones", value: warehouse.totalPositions.toLocaleString(), color: "text-blue-500" },
                            { label: "Ocupadas", value: warehouse.occupiedPositions.toLocaleString(), color: "text-emerald-500" },
                            { label: "Disponibles", value: emptyPositions.toLocaleString(), color: "text-slate-500" },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-1.5 text-center">
                              <p className={cn("text-sm font-bold tabular-nums", stat.color)}>{stat.value}</p>
                              <p className="text-[9px] font-medium text-[var(--text-muted)]">{stat.label}</p>
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
                            transition={{ duration: 1, ease: "easeOut", delay: 0.3 + index * 0.06 }}
                            style={{
                              backgroundColor: warehouse.occupancy > 85 ? "#EF4444" : warehouse.occupancy > 60 ? "#F59E0B" : "#10B981",
                            }}
                          />
                        </div>
                      </div>

                      {/* Hover details panel (shown on hover) */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3 space-y-2">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-[var(--text-muted)]">Tipo</span>
                                <span className="font-semibold text-[var(--text-primary)]">{cfg.label}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-[var(--text-muted)]">Ubicación</span>
                                <span className="font-semibold text-[var(--text-primary)]">{warehouse.location || "—"}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-[var(--text-muted)]">Estado</span>
                                <span className={cn("font-bold", healthStatus.color)}>{healthStatus.label}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-[var(--text-muted)]">Densidad</span>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {warehouse.rackCount > 0 ? Math.round(warehouse.totalPositions / warehouse.rackCount) : 0} pos/rack
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Action buttons with tooltips */}
                      <div className="mt-4 flex gap-2">
                        <Link
                          href={`/almacenes/${warehouse.id}`}
                          className="group/btn relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-hover)] hover:bg-[var(--bg-muted)]"
                        >
                          <Eye size={14} />
                          Vista 2D
                          {/* Animated tooltip */}
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] shadow-lg border border-[var(--border)] opacity-0 scale-90 transition-all group-hover/btn:opacity-100 group-hover/btn:scale-100">
                            Vista de plano 2D con posiciones
                          </span>
                        </Link>
                        <Link
                          href={`/almacenes/${warehouse.id}?view=3d`}
                          className="group/btn relative flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-[var(--brand)]/25"
                        >
                          <Box size={14} />
                          Vista 3D
                          <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
                          {/* Animated tooltip */}
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] shadow-lg border border-[var(--border)] opacity-0 scale-90 transition-all group-hover/btn:opacity-100 group-hover/btn:scale-100">
                            Modelo 3D interactivo del almacén
                          </span>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === "almacenes" && (
          <motion.div key="almacenes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Search + filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar almacén por nombre o ubicación..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2.5 pl-9 pr-4 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/30"
                />
              </div>
              <button className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)]">
                <Filter size={14} />
                Filtros
              </button>
            </div>

            {/* Detailed warehouse list */}
            <div className="space-y-3">
              {filteredWarehouses.map((w, i) => {
                const cfg = typeConfig[w.type] || typeConfig.standard;
                const healthColor = w.occupancy > 90 ? "#EF4444" : w.occupancy > 70 ? "#F59E0B" : "#10B981";
                return (
                  <motion.div
                    key={w.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--brand)]/20 hover:shadow-sm"
                  >
                    {/* Icon */}
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", cfg.bg)}>
                      <cfg.icon size={22} className={cfg.color} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{w.name}</h4>
                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold shrink-0", cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      {w.location && (
                        <p className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-0.5">
                          <MapPin size={10} />
                          {w.location}
                        </p>
                      )}
                    </div>

                    {/* Stats inline */}
                    <div className="hidden sm:flex items-center gap-6 text-center">
                      <div>
                        <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{w.rackCount}</p>
                        <p className="text-[9px] text-[var(--text-muted)]">Racks</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{w.totalPositions.toLocaleString()}</p>
                        <p className="text-[9px] text-[var(--text-muted)]">Posiciones</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold tabular-nums text-emerald-500">{w.occupiedPositions.toLocaleString()}</p>
                        <p className="text-[9px] text-[var(--text-muted)]">Ocupadas</p>
                      </div>
                    </div>

                    {/* Occupancy bar */}
                    <div className="w-24 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tabular-nums" style={{ color: healthColor }}>{w.occupancy}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${w.occupancy}%`, backgroundColor: healthColor }} />
                      </div>
                    </div>

                    {/* Quick actions with tooltips */}
                    <div className="flex gap-1.5">
                      <Link
                        href={`/almacenes/${w.id}`}
                        className="group/btn relative rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                      >
                        <Eye size={14} />
                        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--bg-elevated)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-secondary)] shadow-lg border border-[var(--border)] opacity-0 scale-90 transition-all group-hover/btn:opacity-100 group-hover/btn:scale-100">
                          Vista 2D
                        </span>
                      </Link>
                      <Link
                        href={`/almacenes/${w.id}?view=3d`}
                        className="group/btn relative rounded-lg bg-[var(--brand)] p-2 text-white transition-shadow hover:shadow-md hover:shadow-[var(--brand)]/25"
                      >
                        <Box size={14} />
                        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--bg-elevated)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-secondary)] shadow-lg border border-[var(--border)] opacity-0 scale-90 transition-all group-hover/btn:opacity-100 group-hover/btn:scale-100">
                          Vista 3D
                        </span>
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === "inventario" && (
          <motion.div key="inventario" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Overall inventory summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "SKUs Almacenados", value: kpis.totalOccupied.toLocaleString(), icon: Package, color: "text-indigo-500", bg: "bg-indigo-500/8" },
                { label: "Espacio Disponible", value: kpis.totalAvailable.toLocaleString(), icon: Box, color: "text-slate-500", bg: "bg-slate-500/8" },
                { label: "Ocupación Global", value: `${kpis.avgOccupancy}%`, icon: BarChart3,
                  color: kpis.avgOccupancy > 85 ? "text-red-500" : "text-emerald-500",
                  bg: kpis.avgOccupancy > 85 ? "bg-red-500/8" : "bg-emerald-500/8",
                },
                { label: "Almacenes Críticos", value: kpis.criticalCount, icon: AlertTriangle,
                  color: kpis.criticalCount > 0 ? "text-red-500" : "text-emerald-500",
                  bg: kpis.criticalCount > 0 ? "bg-red-500/8" : "bg-emerald-500/8",
                },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5"
                >
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", kpi.bg)}>
                    <kpi.icon size={16} className={kpi.color} />
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
                    <p className="text-[10px] font-medium text-[var(--text-muted)]">{kpi.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Per-warehouse inventory breakdown */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <h3 className="text-xs font-bold text-[var(--text-primary)]">Distribución de Inventario por Almacén</h3>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {warehouses.map((w) => {
                  const cfg = typeConfig[w.type] || typeConfig.standard;
                  const pct = kpis.totalOccupied > 0 ? Math.round((w.occupiedPositions / kpis.totalOccupied) * 100) : 0;
                  return (
                    <div key={w.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--bg-muted)]/50">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", cfg.bg)}>
                        <cfg.icon size={14} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{w.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{w.occupiedPositions.toLocaleString()} items · {w.rackCount} racks</p>
                      </div>
                      <div className="w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-[var(--text-muted)]">{pct}% del total</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.accentHex }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold tabular-nums text-[var(--text-primary)]">{w.occupancy}%</p>
                        <p className="text-[9px] text-[var(--text-muted)]">Ocupación</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
