"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Warehouse,
  Package,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock,
  Box,
  Repeat2,
  Sparkles,
  Timer,
  BarChart3,
  RefreshCw,
  Loader2,
  Filter,
  ChevronDown,
  Gauge,
  Target,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type { WmsDashboardKpis, WmsAiInsight, WarehouseData, ExpiringLotSummary } from "../types";

type MovementTrend = {
  date: string;
  label: string;
  entradas: number;
  salidas: number;
  traspasos: number;
};

type WmsDashboardProps = {
  kpis: WmsDashboardKpis;
  insights: WmsAiInsight[];
  warehouses: WarehouseData[];
  recentMovements: Array<{
    id: string;
    type: string;
    product: string;
    warehouse: string;
    quantity: number;
    time: string;
    sap_type: string | null;
  }>;
  movementTrends: MovementTrend[];
  operationCounts?: {
    goodsReceipts: { pending: number; posted: number; total: number };
    goodsIssues: { pending: number; posted: number; total: number };
    transfers: { pending: number; posted: number; total: number };
    salesOrders: { pending: number; confirmed: number; picking: number; shipped: number; total: number };
  };
  onNavigateTab?: (tab: string) => void;
  expiringLotsList?: ExpiringLotSummary[];
};

// ── Occupancy Ring (compact) ──────────────────────
function MiniRing({ value, size = 48 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const o = c - (value / 100) * c;
  const color = value > 85 ? "#EF4444" : value > 60 ? "#F59E0B" : "#10B981";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={c} initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: o }} transition={{ duration: 1, ease: "easeOut" }}
        strokeLinecap="round"
      />
    </svg>
  );
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; left: string; shadow: string }> = {
  critical: { color: "text-red-500", bg: "bg-red-500/15", border: "border-red-500/30", left: "border-l-red-500", shadow: "shadow-red-500/5" },
  high: { color: "text-amber-500", bg: "bg-amber-500/15", border: "border-amber-500/30", left: "border-l-amber-500", shadow: "shadow-amber-500/5" },
  medium: { color: "text-blue-500", bg: "bg-blue-500/15", border: "border-blue-500/30", left: "border-l-blue-500", shadow: "shadow-blue-500/5" },
  low: { color: "text-slate-500", bg: "bg-slate-500/15", border: "border-slate-500/30", left: "border-l-slate-500", shadow: "shadow-slate-500/5" },
};

const INSIGHT_TYPE_ICON: Record<string, typeof Sparkles> = {
  prediction: TrendingUp,
  optimization: BarChart3,
  warning: AlertTriangle,
  info: Sparkles,
  anomaly: Activity,
};

const MOVEMENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof ArrowDownToLine; color: string }> = {
  inbound: { label: "Entrada", icon: ArrowDownToLine, color: "text-emerald-500" },
  outbound: { label: "Salida", icon: ArrowUpFromLine, color: "text-rose-500" },
  transfer: { label: "Traspaso", icon: Repeat2, color: "text-blue-500" },
};

// ── Custom Recharts Tooltip ────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-xl shadow-black/10">
      <p className="text-[10px] font-semibold text-text-secondary mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[10px] text-text-muted">{entry.name}</span>
          <span className="text-[11px] font-bold tabular-nums text-text-primary ml-auto">
            {entry.value.toLocaleString()} UN
          </span>
        </div>
      ))}
    </div>
  );
}

export function WmsDashboard({ kpis, insights, warehouses, recentMovements, movementTrends, operationCounts, onNavigateTab, expiringLotsList }: WmsDashboardProps) {
  const [aiInsights, setAiInsights] = useState(insights);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

  // Filter data based on selected warehouse
  const filteredMovements = selectedWarehouse === "all"
    ? recentMovements
    : recentMovements.filter(m => m.warehouse === warehouses.find(w => w.id === selectedWarehouse)?.name);

  const filteredWarehouses = selectedWarehouse === "all"
    ? warehouses
    : warehouses.filter(w => w.id === selectedWarehouse);

  // Recalculate KPIs for filtered warehouse
  const displayKpis = selectedWarehouse === "all" ? kpis : {
    ...kpis,
    totalWarehouses: filteredWarehouses.length,
    totalPositions: filteredWarehouses.reduce((s, w) => s + w.totalPositions, 0),
    occupiedPositions: filteredWarehouses.reduce((s, w) => s + w.occupiedPositions, 0),
    avgOccupancy: filteredWarehouses.length > 0
      ? Math.round(filteredWarehouses.reduce((s, w) => s + w.occupancy, 0) / filteredWarehouses.length)
      : 0,
    criticalWarehouses: filteredWarehouses.filter(w => w.occupancy > 90).length,
  };

  // Derive active alerts from data
  const activeAlerts = [
    ...warehouses.filter(w => w.occupancy > 90).map(w => ({
      id: `occ-${w.id}`,
      severity: "critical" as const,
      title: `${w.name} al ${w.occupancy}% de capacidad`,
      message: `Solo ${w.totalPositions - w.occupiedPositions} posiciones disponibles`,
      action: "operaciones",
      actionLabel: "Crear Traspaso",
    })),
    ...(kpis.expiringLots > 0 ? [{
      id: "lots-expiring",
      severity: "high" as const,
      title: `${kpis.expiringLots} lotes próximos a vencer`,
      message: "Lotes expiran en los próximos 30 días",
      action: "lotes",
      actionLabel: "Ver Lotes",
    }] : []),
    ...(kpis.pendingOrders > 3 ? [{
      id: "pending-orders",
      severity: "medium" as const,
      title: `${kpis.pendingOrders} pedidos pendientes`,
      message: "Pedidos sin iniciar proceso de picking",
      action: "pedidos",
      actionLabel: "Ver Pedidos",
    }] : []),
  ];

  async function handleAnalyzeInsights() {
    setIsGenerating(true);
    setAiError(null);
    try {
      const res = await fetch("/api/wms/insights", { method: "POST" });
      const result = await res.json();
      if (result.success && result.insights) {
        setAiInsights(result.insights);
      } else {
        setAiError(result.message || "Error al analizar");
      }
    } catch (err) {
      console.error("[WMS Dashboard] AI error:", err);
      setAiError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-5"
    >
      {/* ── Dashboard Header with Warehouse Selector ─── */}
      <div className="flex items-center justify-between mb-1" data-tour="dashboard-filter">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <span className="text-[11px] font-medium text-text-muted">Filtrar por almacén:</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-muted transition-colors"
          >
            <Warehouse size={12} className="text-violet-500" />
            {selectedWarehouse === "all" ? "Todos los almacenes" : warehouses.find(w => w.id === selectedWarehouse)?.name || "Todos"}
            <ChevronDown size={12} className={cn("text-text-muted transition-transform", showWarehouseDropdown && "rotate-180")} />
          </button>
          {showWarehouseDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-border bg-surface shadow-xl shadow-black/10 py-1 overflow-hidden"
            >
              <button
                onClick={() => { setSelectedWarehouse("all"); setShowWarehouseDropdown(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-medium hover:bg-muted transition-colors",
                  selectedWarehouse === "all" ? "text-violet-500 bg-violet-500/5" : "text-text-primary"
                )}
              >
                Todos los almacenes
              </button>
              {warehouses.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setSelectedWarehouse(w.id); setShowWarehouseDropdown(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs font-medium hover:bg-muted transition-colors flex items-center justify-between",
                    selectedWarehouse === w.id ? "text-violet-500 bg-violet-500/5" : "text-text-primary"
                  )}
                >
                  <span>{w.name}</span>
                  <span className="text-[9px] font-mono text-text-muted">{w.occupancy}%</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Hero KPIs ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-tour="dashboard-kpis">
        {[
          { label: "Almacenes", value: displayKpis.totalWarehouses, icon: Warehouse, color: "text-violet-500", bg: "bg-violet-500/8" },
          { label: "Posiciones", value: displayKpis.totalPositions.toLocaleString(), icon: Box, color: "text-blue-500", bg: "bg-blue-500/8" },
          {
            label: "Ocupación", value: `${displayKpis.avgOccupancy}%`, icon: TrendingUp,
            color: displayKpis.avgOccupancy > 85 ? "text-red-500" : displayKpis.avgOccupancy > 60 ? "text-amber-500" : "text-emerald-500",
            bg: displayKpis.avgOccupancy > 85 ? "bg-red-500/8" : displayKpis.avgOccupancy > 60 ? "bg-amber-500/8" : "bg-emerald-500/8",
          },
          { label: "Entradas Hoy", value: displayKpis.todayReceipts, icon: ArrowDownToLine, color: "text-emerald-500", bg: "bg-emerald-500/8" },
          { label: "Salidas Hoy", value: displayKpis.todayIssues, icon: ArrowUpFromLine, color: "text-rose-500", bg: "bg-rose-500/8" },
          { label: "Pedidos Pend.", value: displayKpis.pendingOrders, icon: ShoppingCart, color: "text-indigo-500", bg: "bg-indigo-500/8" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", kpi.bg)}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-text-primary">{kpi.value}</p>
              <p className="text-[10px] font-medium text-text-muted">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Movement Trends Chart + Activity Feed ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* AreaChart */}
        {/* data-tour on chart container is added below */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-3 rounded-xl border border-border bg-surface p-4"
          data-tour="dashboard-chart"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary">Movimientos — Últimos 7 Días</h3>
              <p className="text-[10px] text-text-muted">Unidades procesadas por tipo de movimiento</p>
            </div>
            <div className="flex items-center gap-3">
              {[
                { label: "Entradas", color: "#10B981" },
                { label: "Salidas", color: "#F43F5E" },
                { label: "Traspasos", color: "#6366F1" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-[9px] text-text-muted">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={movementTrends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSalidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTraspasos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone" dataKey="entradas" name="Entradas"
                stroke="#10B981" strokeWidth={2} fill="url(#gradEntradas)"
                dot={false} activeDot={{ r: 4, strokeWidth: 2 }}
              />
              <Area
                type="monotone" dataKey="salidas" name="Salidas"
                stroke="#F43F5E" strokeWidth={2} fill="url(#gradSalidas)"
                dot={false} activeDot={{ r: 4, strokeWidth: 2 }}
              />
              <Area
                type="monotone" dataKey="traspasos" name="Traspasos"
                stroke="#6366F1" strokeWidth={2} fill="url(#gradTraspasos)"
                dot={false} activeDot={{ r: 4, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Activity Feed */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-4 flex flex-col max-h-[380px]" data-tour="dashboard-activity">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-text-primary">Actividad Reciente</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
              {recentMovements.length} mov
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
            {filteredMovements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs gap-2 py-6">
                <Clock className="w-5 h-5 animate-pulse" />
                Sin movimientos recientes
              </div>
            ) : (
              filteredMovements.map((m, i) => {
                const cfg = MOVEMENT_TYPE_CONFIG[m.type] || MOVEMENT_TYPE_CONFIG.inbound;
                const MIcon = cfg.icon;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-muted/30 hover:bg-muted transition-colors"
                  >
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", cfg.color === "text-emerald-500" ? "bg-emerald-500/10" : cfg.color === "text-rose-500" ? "bg-rose-500/10" : "bg-blue-500/10")}>
                      <MIcon size={13} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-text-primary truncate">{m.product}</p>
                      <p className="text-[9px] text-text-muted truncate">
                        {m.warehouse} · {m.quantity} UN
                        {m.sap_type && <span className="ml-1 font-mono">({m.sap_type})</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn("text-[10px] font-semibold", cfg.color)}>{cfg.label}</span>
                      <p className="text-[9px] text-text-muted">{m.time}</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Operations Pipeline + Quick Stats ───────── */}
      {operationCounts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pipeline */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <h3 className="text-xs font-bold text-text-primary mb-3">Pipeline de Movimientos</h3>
            <div className="space-y-3">
              {[
                { label: "Entradas", pending: operationCounts.goodsReceipts.pending, posted: operationCounts.goodsReceipts.posted, total: operationCounts.goodsReceipts.total, color: "bg-emerald-500", pendingColor: "bg-emerald-500/30" },
                { label: "Salidas", pending: operationCounts.goodsIssues.pending, posted: operationCounts.goodsIssues.posted, total: operationCounts.goodsIssues.total, color: "bg-rose-500", pendingColor: "bg-rose-500/30" },
                { label: "Traspasos", pending: operationCounts.transfers.pending, posted: operationCounts.transfers.posted, total: operationCounts.transfers.total, color: "bg-blue-500", pendingColor: "bg-blue-500/30" },
                { label: "Pedidos", pending: operationCounts.salesOrders.pending + operationCounts.salesOrders.confirmed, posted: operationCounts.salesOrders.shipped, total: operationCounts.salesOrders.total, color: "bg-indigo-500", pendingColor: "bg-indigo-500/30" },
              ].map((op) => {
                const maxVal = Math.max(op.total, 1);
                return (
                  <div key={op.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-text-secondary">{op.label}</span>
                      <span className="text-[10px] font-mono text-text-muted">
                        {op.posted} completadas · {op.pending} pendientes
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                      <div className={cn("h-full rounded-l-full transition-all", op.color)} style={{ width: `${(op.posted / maxVal) * 100}%` }} />
                      <div className={cn("h-full transition-all", op.pendingColor)} style={{ width: `${(op.pending / maxVal) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-text-muted">Completadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
                  <span className="text-[9px] text-text-muted">Pendientes</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Top Products by Movement (BarChart) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <h3 className="text-xs font-bold text-text-primary mb-3">Top Productos por Movimiento</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={recentMovements
                  .reduce((acc: Array<{ name: string; count: number }>, m) => {
                    const existing = acc.find(a => a.name === m.product);
                    if (existing) existing.count++;
                    else acc.push({ name: m.product.length > 20 ? m.product.substring(0, 18) + '…' : m.product, count: 1 });
                    return acc;
                  }, [])
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 6)
                }
                layout="vertical"
                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value) => [`${value} mov`, "Movimientos"]}
                />
                <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* ── Próximos Vencimientos Widget ────────────── */}
      {expiringLotsList && expiringLotsList.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-surface p-4 shadow-md shadow-black/5"
          data-tour="dashboard-expiring"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
                <AlertTriangle size={13} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-text-primary">Próximos Vencimientos</h3>
                <p className="text-[9px] text-text-muted">Lotes con fecha de expiración más cercana</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab?.("lotes")}
              className="text-[10px] font-bold text-brand hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="space-y-1.5">
            {expiringLotsList.map((lot, i) => {
              const urgent = lot.days_left <= 3;
              const warning = lot.days_left <= 7;
              return (
                <motion.div
                  key={lot.lot_number}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-2 transition-colors",
                    urgent ? "bg-red-500/5 border-l-red-500" :
                    warning ? "bg-amber-500/5 border-l-amber-500" :
                    "bg-muted/30 border-l-emerald-500/40"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                    urgent ? "bg-red-500/15" : warning ? "bg-amber-500/15" : "bg-emerald-500/10"
                  )}>
                    <Clock size={13} className={cn(
                      urgent ? "text-red-500" : warning ? "text-amber-500" : "text-emerald-500",
                      urgent && "animate-pulse"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono font-semibold text-text-primary truncate">{lot.lot_number}</p>
                    <p className="text-[9px] text-text-muted truncate">{lot.product_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      urgent ? "text-red-500" : warning ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {lot.days_left <= 0 ? "¡Hoy!" : `${lot.days_left}d`}
                    </span>
                    <p className="text-[9px] text-text-muted tabular-nums">{lot.remaining_quantity.toLocaleString()} UN</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Warehouse Health Cards ─────────────────── */}
      <div className="space-y-3" data-tour="dashboard-occupancy">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-primary">Estado de Almacenes</h3>
          <span className="text-[10px] text-text-muted">{warehouses.length} activos</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {warehouses.map((w, i) => {
            const healthColor = w.occupancy > 90 ? "#EF4444" : w.occupancy > 70 ? "#F59E0B" : "#10B981";
            const healthLabel = w.occupancy > 90 ? "Crítico" : w.occupancy > 70 ? "Alto" : "Óptimo";
            const HealthIcon = w.occupancy > 90 ? AlertTriangle : w.occupancy > 70 ? Activity : CheckCircle2;
            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="rounded-xl border border-border bg-surface p-4 hover:shadow-md hover:shadow-black/5 transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">{w.name}</h4>
                    {w.sap_plant_code && (
                      <p className="text-[9px] font-mono text-text-muted mt-0.5">
                        Plant {w.sap_plant_code} / SLoc {w.sap_storage_location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: `${healthColor}15` }}>
                    <HealthIcon size={10} style={{ color: healthColor }} />
                    <span className="text-[9px] font-bold" style={{ color: healthColor }}>{healthLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <MiniRing value={w.occupancy} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-black tabular-nums text-text-primary leading-none">{w.occupancy}</span>
                      <span className="text-[8px] text-text-muted">%</span>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-1.5">
                    <div className="rounded-md bg-muted px-2 py-1 text-center">
                      <p className="text-xs font-bold tabular-nums text-text-primary">{w.rackCount}</p>
                      <p className="text-[8px] text-text-muted">Racks</p>
                    </div>
                    <div className="rounded-md bg-muted px-2 py-1 text-center">
                      <p className="text-xs font-bold tabular-nums text-emerald-500">{w.occupiedPositions.toLocaleString()}</p>
                      <p className="text-[8px] text-text-muted">Ocup.</p>
                    </div>
                    <div className="rounded-md bg-muted px-2 py-1 text-center">
                      <p className="text-xs font-bold tabular-nums text-slate-500">{(w.totalPositions - w.occupiedPositions).toLocaleString()}</p>
                      <p className="text-[8px] text-text-muted">Disp.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Active Alerts ─────────────────────── */}
      {activeAlerts.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-md shadow-black/5" data-tour="dashboard-alerts">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/15">
                <AlertTriangle size={12} className="text-red-500" />
              </div>
              <h3 className="text-xs font-bold text-text-primary">Alertas Activas</h3>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">
                {activeAlerts.length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeAlerts.map((alert, i) => {
              const alertSev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn("flex items-center gap-3 rounded-lg border border-l-4 p-3", alertSev.border, alertSev.left)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-text-primary truncate">{alert.title}</p>
                    <p className="text-[9px] text-text-muted">{alert.message}</p>
                  </div>
                  <button
                    onClick={() => onNavigateTab?.(alert.action)}
                    className={cn("shrink-0 text-[9px] font-bold px-2 py-1 rounded-md transition-colors", alertSev.bg, alertSev.color, "hover:opacity-80")}
                  >
                    {alert.actionLabel} →
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Secondary KPIs ───────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Dock-to-Stock \u2205", value: "2.4h", sub: "Tiempo promedio", icon: Gauge, color: "text-cyan-500", bg: "bg-cyan-500/10" },
          { label: "Precisi\u00f3n Inventario", value: "97.8%", sub: "\u00daltimo conteo", icon: Target, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Rotaci\u00f3n Inventario", value: "4.2x", sub: "\u00daltimos 30 d\u00edas", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Picking Time \u2205", value: "15 min", sub: "Por orden", icon: Timer, color: "text-violet-500", bg: "bg-violet-500/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 + i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:shadow-md hover:shadow-black/5 transition-shadow"
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", stat.bg)}>
              <stat.icon size={15} className={stat.color} />
            </div>
            <div>
              <p className="text-sm font-bold tabular-nums text-text-primary">{stat.value}</p>
              <p className="text-[9px] font-medium text-text-muted">{stat.label}</p>
              <p className="text-[8px] text-text-muted">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── AI Insights ─────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-lg shadow-black/5 space-y-4" data-tour="dashboard-ai">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <Sparkles size={16} className="text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Inteligencia del Almacén</h3>
              <p className="text-[10px] text-text-muted">Análisis proactivo con IA</p>
            </div>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20">
              GRIXI AI
            </span>
          </div>
          <button
            onClick={handleAnalyzeInsights}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[11px] font-semibold text-violet-500 hover:bg-violet-500/20 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {isGenerating ? "Analizando..." : "Regenerar"}
          </button>
        </div>
        <AnimatePresence mode="wait">
          {aiInsights.length > 0 ? (
            <motion.div
              key="insights-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {aiInsights.filter(i => !i.is_dismissed).map((insight, idx) => {
                const sev = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.low;
                const InsightIcon = INSIGHT_TYPE_ICON[insight.insight_type] || Sparkles;
                return (
                    <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className={cn(
                      "rounded-xl border border-l-4 bg-surface p-4 shadow-md transition-all hover:shadow-lg",
                      sev.border, sev.left, sev.shadow
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", sev.bg)}>
                        <InsightIcon size={18} className={sev.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="text-[13px] font-bold text-text-primary truncate">{insight.title}</h4>
                          <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0", sev.bg, sev.color)}>
                            {insight.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">{insight.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {insight.warehouse_name && (
                            <span className="text-[9px] text-text-muted flex items-center gap-1">
                              <Warehouse size={9} /> {insight.warehouse_name}
                            </span>
                          )}
                          {insight.action && (insight.action as Record<string, string>).tab && (
                            <button
                              onClick={() => onNavigateTab?.((insight.action as Record<string, string>).tab)}
                              className="flex items-center gap-1 text-[9px] font-bold text-brand hover:underline ml-auto"
                            >
                              {(insight.action as Record<string, string>).label || "Ver"}
                              <ArrowRight size={9} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="no-insights"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-10 text-text-muted rounded-xl border border-dashed border-border bg-muted"
            >
              <Sparkles size={24} className="mb-3 opacity-30" />
              <p className="text-xs font-medium">Haz clic en &quot;Regenerar&quot; para analizar tu inventario</p>
            </motion.div>
          )}
        </AnimatePresence>
        {aiError && (
          <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-400">
            ⚠ {aiError}
          </div>
        )}
      </div>

      {/* ── Quick Stats Strip ─────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Traspasos Pendientes", value: displayKpis.pendingTransfers, icon: Repeat2, color: "text-blue-500", bg: "bg-blue-500/15" },
          { label: "Productos Activos", value: displayKpis.totalProducts, icon: Package, color: "text-indigo-500", bg: "bg-indigo-500/15" },
          { label: "Lotes por Vencer", value: displayKpis.expiringLots, icon: Timer, color: displayKpis.expiringLots > 0 ? "text-amber-500" : "text-emerald-500", bg: displayKpis.expiringLots > 0 ? "bg-amber-500/15" : "bg-emerald-500/15" },
          { label: "Almacenes Críticos", value: displayKpis.criticalWarehouses, icon: AlertTriangle, color: displayKpis.criticalWarehouses > 0 ? "text-red-500" : "text-emerald-500", bg: displayKpis.criticalWarehouses > 0 ? "bg-red-500/15" : "bg-emerald-500/15" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-md shadow-black/5"
          >
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stat.bg)}>
              <stat.icon size={16} className={stat.color} />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-text-primary">{stat.value}</p>
              <p className="text-[10px] font-medium text-text-muted">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
