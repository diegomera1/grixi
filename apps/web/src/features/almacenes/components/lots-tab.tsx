"use client";

import { useState, useMemo, useEffect, useCallback, startTransition } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Search, AlertTriangle, XCircle, Timer, CheckCircle2,
  ShieldAlert, Package, CalendarClock, ChevronDown, ChevronRight,
  Box, MapPin, Truck, Ban, Send, Loader2, Sparkles,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchLotsGroupedByMaterial } from "../actions/stock-hierarchy-actions";
import type { MaterialLotGroup, LotWithUAs } from "../actions/stock-hierarchy-actions";

// ── Types ─────────────────────────────────────────────
type FilterStatus = "all" | "active" | "expired" | "quarantine" | "expiring" | "no_uas";
type SortBy = "expiry" | "name" | "stock" | "lots";
type AIInsight = {
  summary: string;
  recommendations: string[];
  risk_level?: string;
  urgentLots?: Array<{
    lot_number: string;
    product_name: string;
    days_to_expiry: number | null;
    quantity: number;
    action: string;
  }>;
};

// ── Helpers ───────────────────────────────────────────
function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function expiryBadge(days: number | null, status: string) {
  if (status === "expired" || (days !== null && days <= 0))
    return { label: days !== null ? `Vencido (${Math.abs(days!)} días)` : "Vencido", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle };
  if (days !== null && days <= 7)
    return { label: `${days} días`, cls: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse", icon: AlertTriangle };
  if (days !== null && days <= 30)
    return { label: `${days} días`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Timer };
  if (days !== null && days <= 90)
    return { label: `${days} días`, cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icon: CalendarClock };
  if (days !== null)
    return { label: `${days} días`, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 };
  return null;
}

// ── Props ─────────────────────────────────────────────
type LotsTabProps = {
  lots: Array<{ id: string; lot_number: string; status: string; [key: string]: unknown }>; // legacy prop kept for compatibility
  onOpenLotDetail?: (lotId: string) => void;
  onNavigateToOperations?: (action: string, productId?: string) => void;
};

// ══════════════════════════════════════════════════════
// ── MAIN COMPONENT ───────────────────────────────────
// ══════════════════════════════════════════════════════
export function LotsTab({ onOpenLotDetail, onNavigateToOperations }: LotsTabProps) {
  const [materials, setMaterials] = useState<MaterialLotGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("expiry");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [actioningLot, setActioningLot] = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLotsGroupedByMaterial();
      startTransition(() => {
        setMaterials(data);
        // Auto-expand materials with urgent lots
        const urgent = new Set<string>();
        for (const m of data) {
          if (m.hasExpired || m.hasExpiring) urgent.add(m.product_id);
        }
        setExpandedMaterials(urgent);
        setLoading(false);
      });
    } catch (err) {
      console.error("[LotsTab] loadData error:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Load AI analysis ─────────────────────────────────
  useEffect(() => {
    setAiLoading(true);
    fetch("/api/wms/lot-analysis")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setAiInsight(res.data);
      })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, []);

  // ── Stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalLots = 0, active = 0, expired = 0, expiring = 0, quarantine = 0, totalUAs = 0, noUAs = 0;
    for (const m of materials) {
      for (const l of m.lots) {
        totalLots++;
        totalUAs += l.storage_units.length;
        if (l.storage_units.length === 0) noUAs++;
        if (l.status === "expired") { expired++; continue; }
        if (l.status === "quarantine") { quarantine++; continue; }
        const days = daysUntilExpiry(l.expiry_date);
        if (days !== null && days <= 0) { expired++; continue; }
        if (days !== null && days <= 30) { expiring++; active++; continue; }
        if (l.status === "active") active++;
      }
    }
    return { totalLots, active, expired, expiring, quarantine, totalUAs, noUAs };
  }, [materials]);

  // ── Available warehouses for filter ──────────────────
  const warehouseOptions = useMemo(() => {
    const wh = new Map<string, string>();
    for (const m of materials) {
      for (const l of m.lots) {
        for (const su of l.storage_units) {
          if (!wh.has(su.warehouse_name)) wh.set(su.warehouse_name, su.warehouse_name);
        }
      }
    }
    return Array.from(wh.entries()).map(([, name]) => name).sort();
  }, [materials]);

  // ── Filtered + sorted materials ───────────────────────
  const filteredMaterials = useMemo(() => {
    const mapped = materials.map((m) => {
      const filteredLots = m.lots.filter((l) => {
        // Status filter
        if (statusFilter === "expired") return l.status === "expired" || (daysUntilExpiry(l.expiry_date) !== null && daysUntilExpiry(l.expiry_date)! <= 0);
        if (statusFilter === "expiring") {
          const d = daysUntilExpiry(l.expiry_date);
          return l.status === "active" && d !== null && d > 0 && d <= 30;
        }
        if (statusFilter === "quarantine") return l.status === "quarantine";
        if (statusFilter === "active") return l.status === "active";
        if (statusFilter === "no_uas") return l.storage_units.length === 0;
        return true;
      }).filter((l) => {
        // Warehouse filter
        if (warehouseFilter === "all") return true;
        return l.storage_units.some((su) => su.warehouse_name === warehouseFilter);
      }).filter((l) => {
        // Text search
        if (!search) return true;
        const q = search.toLowerCase();
        return l.lot_number.toLowerCase().includes(q) ||
          m.product_name.toLowerCase().includes(q) ||
          m.product_sku.toLowerCase().includes(q) ||
          (l.vendor_name?.toLowerCase().includes(q) ?? false) ||
          l.storage_units.some((su) => su.su_code.toLowerCase().includes(q) || su.rack_code.toLowerCase().includes(q));
      });
      return { ...m, lots: filteredLots };
    }).filter((m) => m.lots.length > 0);

    // Sort materials
    return mapped.sort((a, b) => {
      if (sortBy === "expiry") {
        return (a.daysToNearestExpiry ?? 9999) - (b.daysToNearestExpiry ?? 9999);
      }
      if (sortBy === "name") return a.product_name.localeCompare(b.product_name);
      if (sortBy === "stock") return b.totalStock - a.totalStock;
      if (sortBy === "lots") return b.totalLots - a.totalLots;
      return 0;
    });
  }, [materials, search, statusFilter, warehouseFilter, sortBy]);

  // ── Toggle expand ────────────────────────────────────
  const toggleMaterial = (id: string) => {
    setExpandedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedMaterials(new Set(filteredMaterials.map((m) => m.product_id)));
  const collapseAll = () => setExpandedMaterials(new Set());

  // ── Lot action ───────────────────────────────────────
  const handleLotAction = async (lotId: string, lotNumber: string, action: string) => {
    setActioningLot(lotId);
    try {
      const res = await fetch("/api/wms/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_lot_status",
          lot_id: lotId,
          new_status: action === "quarantine" ? "quarantine" : action === "consumed" ? "consumed" : "active",
        }),
      });
      const data = await res.json();
      if (data.success) {
        const labels: Record<string, string> = {
          quarantine: "enviado a cuarentena",
          consumed: "marcado como consumido/dispuesto",
        };
        toast.success(`Lote ${lotNumber}`, { description: labels[action] || "actualizado" });
        loadData(); // refresh
      } else {
        toast.error("Error", { description: data.message });
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setActioningLot(null);
    }
  };

  // ── Filter buttons ───────────────────────────────────
  const filterButtons: { id: FilterStatus; label: string; count: number; icon?: typeof XCircle; color?: string }[] = [
    { id: "all", label: "Todos", count: stats.totalLots },
    { id: "active", label: "Activos", count: stats.active, icon: CheckCircle2, color: "text-emerald-400" },
    { id: "expiring", label: "Por Vencer", count: stats.expiring, icon: Timer, color: "text-amber-400" },
    { id: "expired", label: "Vencidos", count: stats.expired, icon: XCircle, color: "text-red-400" },
    { id: "quarantine", label: "Cuarentena", count: stats.quarantine, icon: ShieldAlert, color: "text-orange-400" },
    { id: "no_uas", label: "Sin Ubicación", count: stats.noUAs, icon: MapPin, color: "text-slate-400" },
  ];

  const hasActiveFilters = statusFilter !== "all" || warehouseFilter !== "all" || search !== "" || sortBy !== "expiry";

  const clearAllFilters = () => {
    setStatusFilter("all");
    setWarehouseFilter("all");
    setSearch("");
    setSortBy("expiry");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4" data-tour="lotes-content">
      {/* ── ALERT BANNERS ── */}
      {(stats.expired > 0 || stats.expiring > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.expired > 0 && (
            <button onClick={() => setStatusFilter("expired")}
              className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all",
                statusFilter === "expired" ? "border-red-500/40 bg-red-500/10 ring-1 ring-red-500/20" : "border-red-500/20 bg-red-500/5 hover:bg-red-500/10")}>
              <XCircle size={14} className="text-red-500" />
              <span className="text-xs font-semibold text-red-500">{stats.expired} lote{stats.expired > 1 ? "s" : ""} vencido{stats.expired > 1 ? "s" : ""}</span>
              <span className="text-[10px] text-red-400/60">Requieren disposición</span>
            </button>
          )}
          {stats.expiring > 0 && (
            <button onClick={() => setStatusFilter("expiring")}
              className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all",
                statusFilter === "expiring" ? "border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/20" : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10")}>
              <Timer size={14} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-500">{stats.expiring} lote{stats.expiring > 1 ? "s" : ""} por vencer</span>
              <span className="text-[10px] text-amber-400/60">Priorizar FEFO</span>
            </button>
          )}
        </div>
      )}

      {/* ── KPI CARDS (clickable) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Total Lotes", value: stats.totalLots, color: "text-text-primary", bg: "bg-brand/5", border: "border-brand/10", filter: "all" as FilterStatus },
          { label: "Activos", value: stats.active, color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/10", filter: "active" as FilterStatus },
          { label: "Por Vencer", value: stats.expiring, color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/10", filter: "expiring" as FilterStatus },
          { label: "Vencidos", value: stats.expired, color: "text-red-400", bg: "bg-red-500/5", border: "border-red-500/10", filter: "expired" as FilterStatus },
          { label: "Sin Ubicar", value: stats.noUAs, color: "text-slate-400", bg: "bg-slate-500/5", border: "border-slate-500/10", filter: "no_uas" as FilterStatus },
        ].map((kpi) => (
          <button key={kpi.label} onClick={() => setStatusFilter(kpi.filter)}
            className={cn("rounded-xl border p-3 text-left transition-all",
              kpi.bg,
              statusFilter === kpi.filter ? `${kpi.border} ring-1 ring-brand/20` : "border-border hover:border-border/80")}>
            <div className={cn("text-xl font-bold tabular-nums", kpi.color)}>{kpi.value}</div>
            <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider">{kpi.label}</div>
          </button>
        ))}
      </div>

      {/* ── AI INSIGHT BANNER ── */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-text-primary">Análisis Inteligente de Lotes</span>
              {aiInsight?.risk_level && (
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", {
                  "bg-emerald-500/15 text-emerald-400": aiInsight.risk_level === "low",
                  "bg-amber-500/15 text-amber-400": aiInsight.risk_level === "medium",
                  "bg-red-500/15 text-red-400": aiInsight.risk_level === "high" || aiInsight.risk_level === "critical",
                })}>
                  {aiInsight.risk_level === "low" ? "Bajo riesgo" : aiInsight.risk_level === "medium" ? "Riesgo medio" : "Alto riesgo"}
                </span>
              )}
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 size={12} className="animate-spin" /> Analizando lotes...
              </div>
            ) : aiInsight ? (
              <div className="space-y-1.5">
                <p className="text-xs text-text-secondary leading-relaxed">{aiInsight.summary}</p>
                {aiInsight.recommendations && aiInsight.recommendations.length > 0 && (
                  <ul className="space-y-1">
                    {aiInsight.recommendations.slice(0, 3).map((r, i) => (
                      <li key={i} className="text-[11px] text-text-muted flex items-start gap-1.5">
                        <span className="text-brand mt-0.5">▸</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No se pudo cargar el análisis</p>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTERS BAR ── */}
      <div className="space-y-3">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
          {filterButtons.map((fb) => (
            <button key={fb.id} onClick={() => setStatusFilter(fb.id)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                statusFilter === fb.id ? "bg-surface shadow-sm text-text-primary" : "text-text-muted hover:text-text-secondary")}>
              {fb.icon && <fb.icon size={11} className={statusFilter === fb.id ? (fb.color || "") : ""} />}
              <span>{fb.label}</span>
              <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full",
                statusFilter === fb.id ? "bg-brand/10 text-brand" : "bg-muted text-text-muted")}>
                {fb.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Sort + Warehouse + Expand/Collapse */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Buscar lote, material, proveedor, rack..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none" />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-text-muted">
                <XCircle size={12} />
              </button>
            )}
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none cursor-pointer">
            <option value="expiry">Vencimiento</option>
            <option value="name">Nombre A-Z</option>
            <option value="stock">Mayor stock</option>
            <option value="lots">Más lotes</option>
          </select>

          {/* Warehouse filter */}
          {warehouseOptions.length > 0 && (
            <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none cursor-pointer">
              <option value="all">Todos los almacenes</option>
              {warehouseOptions.map((wh) => (
                <option key={wh} value={wh}>{wh}</option>
              ))}
            </select>
          )}

          {/* Expand / Collapse */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={expandAll}
              className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronDown size={12} /> Expandir
            </button>
            <button onClick={collapseAll}
              className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight size={12} /> Colapsar
            </button>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-text-muted font-medium">Filtros:</span>
            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-brand/10 text-brand">
                {filterButtons.find((f) => f.id === statusFilter)?.label}
                <button onClick={() => setStatusFilter("all")} className="hover:text-brand/70"><XCircle size={10} /></button>
              </span>
            )}
            {warehouseFilter !== "all" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400">
                {warehouseFilter}
                <button onClick={() => setWarehouseFilter("all")} className="hover:text-cyan-300"><XCircle size={10} /></button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-violet-500/10 text-violet-400">
                &quot;{search}&quot;
                <button onClick={() => setSearch("")} className="hover:text-violet-300"><XCircle size={10} /></button>
              </span>
            )}
            {sortBy !== "expiry" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-muted text-text-muted">
                Orden: {{ name: "Nombre", stock: "Stock", lots: "Lotes" }[sortBy]}
                <button onClick={() => setSortBy("expiry")} className="hover:text-text-primary"><XCircle size={10} /></button>
              </span>
            )}
            <button onClick={clearAllFilters}
              className="text-[10px] font-medium text-red-400 hover:text-red-300 px-2 py-1 rounded-full hover:bg-red-500/10 transition-colors">
              Limpiar todo
            </button>
            <span className="text-[10px] text-text-muted ml-auto tabular-nums">
              {filteredMaterials.reduce((acc, m) => acc + m.lots.length, 0)} resultado{filteredMaterials.reduce((acc, m) => acc + m.lots.length, 0) !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── MATERIALS LIST ── */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <FlaskConical size={28} className="mb-2 opacity-30" />
              <p className="text-xs">No hay materiales con lotes que coincidan</p>
            </div>
          ) : (
            filteredMaterials.map((material, mi) => {
              const isExpanded = expandedMaterials.has(material.product_id);
              return (
                <motion.div key={material.product_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: mi * 0.02 }}
                  className={cn("rounded-xl border overflow-hidden transition-all",
                    material.hasExpired ? "border-red-500/30" :
                    material.hasExpiring ? "border-amber-500/20" :
                    "border-border"
                  )}>
                  {/* Material Header */}
                  <button onClick={() => toggleMaterial(material.product_id)}
                    className={cn("w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50",
                      material.hasExpired ? "bg-red-500/5" : material.hasExpiring ? "bg-amber-500/5" : "bg-surface")}>
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                      <Package size={18} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text-primary">{material.product_name}</span>
                        <span className="text-[10px] font-mono text-text-muted bg-muted px-1.5 py-0.5 rounded">{material.product_sku}</span>
                        {material.hasExpired && (
                          <span className="text-[9px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle size={8} /> VENCIDO
                          </span>
                        )}
                        {material.hasExpiring && !material.hasExpired && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                            <AlertTriangle size={8} /> POR VENCER
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-muted">
                        <span>{material.totalStock.toLocaleString("es-EC")} UN</span>
                        <span>·</span>
                        <span>{material.totalLots} lote{material.totalLots > 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{material.totalUAs} UA{material.totalUAs !== 1 ? "s" : ""}</span>
                        {material.daysToNearestExpiry !== null && material.daysToNearestExpiry > 0 && (
                          <>
                            <span>·</span>
                            <span className={cn(material.daysToNearestExpiry <= 30 ? "text-amber-400 font-medium" : "")}>
                              Vence en {material.daysToNearestExpiry}d
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-text-muted">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>

                  {/* Lots under this material */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="border-t border-border/50 divide-y divide-border/30">
                          {material.lots.map((lot) => (
                            <LotRow key={lot.id} lot={lot} material={material}
                              onOpenDetail={() => onOpenLotDetail?.(lot.id)}
                              onAction={handleLotAction}
                              onNavigate={onNavigateToOperations}
                              actioningLot={actioningLot} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── LOT ROW COMPONENT ─────────────────────────────────
function LotRow({ lot, material, onOpenDetail, onAction, onNavigate, actioningLot }: {
  lot: LotWithUAs;
  material: MaterialLotGroup;
  onOpenDetail: () => void;
  onAction: (lotId: string, lotNumber: string, action: string) => void;
  onNavigate?: (action: string, productId?: string) => void;
  actioningLot: string | null;
}) {
  const days = daysUntilExpiry(lot.expiry_date);
  const badge = expiryBadge(days, lot.status);
  const isExpired = lot.status === "expired" || (days !== null && days <= 0);
  const isExpiring = !isExpired && days !== null && days <= 30;
  const isActioning = actioningLot === lot.id;
  const usagePercent = lot.total_quantity > 0
    ? Math.round(((lot.total_quantity - lot.remaining_quantity) / lot.total_quantity) * 100)
    : 0;

  const isCritical = !isExpired && days !== null && days <= 7;

  return (
    <div onClick={onOpenDetail}
      className={cn("px-4 py-3 transition-colors hover:bg-muted/30 cursor-pointer border-l-2",
      isExpired ? "bg-red-500/3 border-l-red-500/60" :
      isCritical ? "bg-red-500/5 border-l-red-500 animate-pulse" :
      isExpiring ? "bg-amber-500/3 border-l-amber-500/40" : "border-l-transparent")}>
      <div className="flex items-start gap-3">
        {/* Lot icon */}
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isExpired ? "bg-red-500/15" : isExpiring ? "bg-amber-500/15" :
          lot.status === "quarantine" ? "bg-orange-500/15" : "bg-emerald-500/10")}>
          <FlaskConical size={14} className={cn(
            isExpired ? "text-red-400" : isExpiring ? "text-amber-400" :
            lot.status === "quarantine" ? "text-orange-400" : "text-emerald-400")} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold font-mono text-text-primary">{lot.lot_number}</span>
            {badge && (
              <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", badge.cls)}>
                <badge.icon size={8} /> {badge.label}
              </span>
            )}
            {lot.status === "quarantine" && (
              <span className="text-[9px] font-bold text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldAlert size={8} /> Cuarentena
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted flex-wrap">
            {lot.vendor_name && <span>Prov: {lot.vendor_name}</span>}
            <span>Fab: {formatDate(lot.manufacturing_date)}</span>
            <span>Venc: {formatDate(lot.expiry_date)}</span>
          </div>

          {/* Storage Units preview */}
          {lot.storage_units.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {lot.storage_units.slice(0, 3).map((su) => (
                <span key={su.id} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-muted text-text-muted font-mono">
                  {su.su_type === "palet" ? <Archive size={8} /> : <Box size={8} />}
                  {su.su_code} · {su.quantity} UN
                  <span className="text-text-muted/60">@ {su.rack_code}-{su.row_number}-{su.column_number}</span>
                </span>
              ))}
              {lot.storage_units.length > 3 && (
                <span className="text-[9px] text-text-muted">+{lot.storage_units.length - 3} más</span>
              )}
            </div>
          )}
          {lot.storage_units.length === 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-[9px] text-text-muted/60">
              <MapPin size={8} /> Sin ubicación física asignada
            </div>
          )}

          {/* Quick actions */}
          <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
            {(isExpiring || lot.status === "active") && onNavigate && (
              <button onClick={() => onNavigate("goods_issue", material.product_id)}
                className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
                <Send size={9} /> Despachar FEFO
              </button>
            )}

            {lot.status === "active" && onNavigate && (
              <button onClick={() => onNavigate("transfer", material.product_id)}
                className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
                <Truck size={9} /> Traspasar
              </button>
            )}

            {lot.status === "active" && (
              <button onClick={() => onAction(lot.id, lot.lot_number, "quarantine")}
                disabled={isActioning}
                className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 size={9} className="animate-spin" /> : <Ban size={9} />} Cuarentena
              </button>
            )}

            {isExpired && (
              <button onClick={() => onAction(lot.id, lot.lot_number, "consumed")}
                disabled={isActioning}
                className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                {isActioning ? <Loader2 size={9} className="animate-spin" /> : <Package size={9} />} Disposición
              </button>
            )}
          </div>
        </div>

        {/* Quantity */}
        <div className="text-right shrink-0 space-y-1">
          <p className="text-sm font-bold text-text-primary tabular-nums">
            {lot.remaining_quantity.toLocaleString("es-EC")}
            <span className="text-[10px] text-text-muted font-normal ml-0.5">/ {lot.total_quantity.toLocaleString("es-EC")}</span>
          </p>
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden ml-auto">
            <div className={cn("h-full rounded-full transition-all",
              usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${usagePercent}%` }} />
          </div>
          <p className="text-[9px] text-text-muted">{usagePercent}% consumido</p>
        </div>
      </div>
    </div>
  );
}
