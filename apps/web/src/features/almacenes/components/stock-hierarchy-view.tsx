"use client";

import { useState, useMemo, useEffect, useCallback, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, ChevronRight, ChevronDown, Box, MapPin, Search, Filter,
  AlertTriangle, CheckCircle2, Clock, Truck, Archive, Layers, Eye,
} from "lucide-react";
import { fetchStockHierarchy } from "../actions/stock-hierarchy-actions";
import type {
  StockHierarchyProduct, StockHierarchyLot, StockHierarchySU,
  StorageUnitType, StorageUnitStatus,
} from "../types";
import { SU_TYPE_LABELS, SU_STATUS_LABELS } from "../types";

// ── SU Type Icon ────────────────────────────────────────────────
function SUTypeIcon({ type, className = "" }: { type: StorageUnitType; className?: string }) {
  switch (type) {
    case "palet":
      return <Layers className={className} />;
    case "tina":
      return <Box className={className} />;
    case "caja":
      return <Archive className={className} />;
    case "contenedor":
      return <Package className={className} />;
  }
}

// ── SU Status Badge ─────────────────────────────────────────────
function SUStatusBadge({ status }: { status: StorageUnitStatus }) {
  const colorMap: Record<StorageUnitStatus, string> = {
    available: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    reserved: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    picking: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    picked: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    in_transit: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    empty: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
  };

  const iconMap: Record<StorageUnitStatus, React.ReactNode> = {
    available: <CheckCircle2 className="w-3 h-3" />,
    reserved: <Clock className="w-3 h-3" />,
    picking: <Package className="w-3 h-3" />,
    picked: <CheckCircle2 className="w-3 h-3" />,
    in_transit: <Truck className="w-3 h-3" />,
    empty: <Box className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${colorMap[status]}`}>
      {iconMap[status]}
      {SU_STATUS_LABELS[status]}
    </span>
  );
}

// ── Storage Unit Row ────────────────────────────────────────────
function StorageUnitRow({ su, onClickOpenDetail }: { su: StockHierarchySU; onClickOpenDetail?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClickOpenDetail}
      className={`flex items-center py-2 pl-10 pr-4 border-l border-brand/10 hover:bg-brand/5 rounded-r-lg transition-colors gap-x-3 relative ${onClickOpenDetail ? "cursor-pointer" : ""}`}
    >
      {/* Tree connector */}
      <div className="absolute left-0 top-1/2 w-3 h-px bg-brand/10" />

      {/* Left: SU info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-md bg-cyan-500/8 flex items-center justify-center shrink-0">
          <SUTypeIcon type={su.su_type} className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <span className="text-[13px] font-mono font-medium text-text-primary">{su.su_code}</span>
          <span className="ml-1.5 text-[10px] text-text-muted/60">({SU_TYPE_LABELS[su.su_type]})</span>
        </div>
      </div>

      {/* Right: data — pushed to far right */}
      <div className="flex items-center gap-4 ml-auto shrink-0">
        {/* Quantity */}
        <div className="text-right w-[130px]">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-[13px] font-semibold text-text-primary tabular-nums">{su.quantity.toLocaleString()} UN</span>
            {su.reserved_quantity > 0 && (
              <span className="text-[10px] text-amber-400 tabular-nums">
                ({su.reserved_quantity} res.)
              </span>
            )}
          </div>
          {su.reserved_quantity > 0 && (
            <div className="text-[10px] text-emerald-400 tabular-nums">
              {su.available_quantity.toLocaleString()} disponibles
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted w-[160px] justify-end whitespace-nowrap">
          <MapPin className="w-3 h-3 shrink-0 text-text-muted/40" />
          <span className="truncate">{su.warehouse_name}</span>
          <span className="text-text-muted/30">›</span>
          <span className="font-mono text-text-muted/70">{su.rack_code}-{su.row_number}-{su.column_number}</span>
        </div>

        {/* Status */}
        <SUStatusBadge status={su.status} />
      </div>
    </motion.div>
  );
}

// ── Lot Expandable Row ──────────────────────────────────────────
function LotRow({
  lot,
  onOpenLotDetail,
}: {
  lot: StockHierarchyLot;
  onOpenLotDetail?: (lotId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const daysUntilExpiry = useMemo(() => {
    if (!lot.expiry_date) return null;
    // eslint-disable-next-line
    return Math.ceil((new Date(lot.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [lot.expiry_date]);

  const expiryColor =
    daysUntilExpiry !== null
      ? daysUntilExpiry <= 0
        ? "text-red-400"
        : daysUntilExpiry <= 30
        ? "text-amber-400"
        : daysUntilExpiry <= 90
        ? "text-yellow-400"
        : "text-emerald-400"
      : "text-text-muted";

  const totalQuantity = lot.storage_units?.reduce((acc, su) => acc + su.quantity, 0) ?? 0;
  const totalAvailable = lot.storage_units?.reduce((acc, su) => acc + su.available_quantity, 0) ?? 0;
  const suCount = lot.storage_units?.length ?? 0;

  return (
    <div className="relative">
      {/* Vertical tree connector */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-amber-500/15" />

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center w-full py-2.5 pl-8 pr-4 hover:bg-amber-500/5 rounded-lg transition-colors group gap-x-3 relative"
      >
        {/* Horizontal connector to parent line */}
        <div className="absolute left-2 top-1/2 w-4 h-px bg-amber-500/15" />

        {/* Left: Lot info */}
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-muted/50 group-hover:text-amber-500 transition-colors shrink-0" />
          )}
          <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/15 flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold text-amber-400/60 uppercase tracking-wider shrink-0">Lote</span>
            <span className="text-[13px] font-mono font-semibold text-text-primary truncate">{lot.lot_number}</span>
          </div>
          {lot.vendor_name && (
            <span className="text-[11px] text-text-muted/50 truncate hidden md:inline">• {lot.vendor_name}</span>
          )}
        </div>

        {/* Right: data — pushed to far right */}
        <div className="flex items-center gap-4 ml-auto shrink-0">
          {/* Quantities */}
          <div className="text-right w-[130px]">
            <span className="text-[13px] font-semibold text-text-primary tabular-nums">{totalQuantity.toLocaleString()} UN</span>
            {totalAvailable !== totalQuantity && (
              <span className="text-[11px] text-emerald-400 ml-1.5 tabular-nums">
                ({totalAvailable.toLocaleString()} disp.)
              </span>
            )}
            {totalAvailable === totalQuantity && (
              <span className="text-[11px] text-text-muted/30 ml-1.5">
                (todo disp.)
              </span>
            )}
          </div>

          {/* Expiry */}
          {lot.expiry_date ? (
            <div className={`flex items-center gap-1 text-[11px] ${expiryColor} w-[60px] justify-end`}>
              {daysUntilExpiry !== null && daysUntilExpiry <= 0 ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {daysUntilExpiry !== null && daysUntilExpiry <= 0
                ? "Vencido"
                : `${daysUntilExpiry}d`}
            </div>
          ) : <div className="w-[60px]" />}

          {/* SU count + detail */}
          <div className="flex items-center gap-2.5 w-[100px] justify-end">
            <span className="text-[11px] text-text-muted/50 tabular-nums whitespace-nowrap">
              {suCount} UA{suCount !== 1 ? "s" : ""}
            </span>

            {onOpenLotDetail && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLotDetail(lot.lot_id);
                }}
                className="text-[11px] text-brand hover:text-brand-light transition-colors px-2 py-0.5 rounded-md hover:bg-brand/10 cursor-pointer whitespace-nowrap"
              >
                Ver detalle
              </span>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && lot.storage_units && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pb-2 pl-6">
              {lot.storage_units.map((su) => (
                <StorageUnitRow
                  key={su.su_id}
                  su={su}
                  onClickOpenDetail={onOpenLotDetail ? () => onOpenLotDetail(lot.lot_id) : undefined}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Product Expandable Row ──────────────────────────────────────
function ProductRow({
  product,
  defaultExpanded = false,
  onOpenLotDetail,
}: {
  product: StockHierarchyProduct;
  defaultExpanded?: boolean;
  onOpenLotDetail?: (lotId: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const occupancyPct = product.total_stock > 0
    ? Math.round((product.total_reserved / product.total_stock) * 100)
    : 0;

  return (
    <motion.div
      layout
      className="bg-surface border border-border rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center w-full p-4 hover:bg-brand/5 transition-colors group gap-x-3"
      >
        {/* ── Left: Product info + expand arrow ── */}
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-brand shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-brand transition-colors shrink-0" />
          )}
          <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-brand" />
          </div>
          <div className="text-left min-w-0">
            <div className="font-semibold text-text-primary truncate">{product.product_name}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-mono">{product.product_sku}</span>
              <span className="text-[9px] font-semibold text-brand/40 uppercase tracking-wider">Material</span>
            </div>
          </div>
          {/* Inline counts on desktop */}
          <div className="hidden lg:flex items-center gap-2 ml-2 text-[10px] text-text-muted whitespace-nowrap tabular-nums shrink-0">
            <span className="rounded bg-muted px-1.5 py-0.5">{product.lot_count} lotes</span>
            <span className="rounded bg-muted px-1.5 py-0.5">{product.su_count} UAs</span>
            <span className="rounded bg-muted px-1.5 py-0.5">{product.warehouse_count} alm.</span>
          </div>
        </div>

        {/* ── Right: All numeric data — pushed to far right ── */}
        <div className="flex items-center gap-4 shrink-0 ml-auto">
          {/* Stock total */}
          <div className="text-right w-[80px]">
            <div className="text-lg font-bold text-text-primary tabular-nums leading-tight">{product.total_stock.toLocaleString()}</div>
            <div className="text-[10px] text-text-muted">Stock total</div>
          </div>

          {/* Disponible */}
          <div className="text-right w-[80px]">
            <div className="text-sm font-semibold text-emerald-400 tabular-nums leading-tight">{product.total_available.toLocaleString()}</div>
            <div className="text-[10px] text-text-muted">Disponible</div>
          </div>

          {/* Reservado */}
          <div className="text-right w-[80px]">
            <div className={`text-sm font-semibold tabular-nums leading-tight ${product.total_reserved > 0 ? "text-amber-400" : "text-text-muted/40"}`}>
              {product.total_reserved.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-muted">Reservado</div>
          </div>

          {/* Mini bar */}
          <div className="hidden md:block w-[70px]">
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-brand to-brand-light rounded-full transition-all"
                style={{ width: `${Math.min(occupancyPct, 100)}%` }}
              />
            </div>
            <div className="text-[9px] text-text-muted mt-0.5 text-center tabular-nums">
              {occupancyPct}% reservado
            </div>
          </div>

          {/* 3D button */}
          {onOpenLotDetail && product.lots && product.lots.length > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onOpenLotDetail(product.lots![0].lot_id);
              }}
              className="flex items-center gap-1 text-[10px] text-brand hover:text-brand-light transition-colors px-2 py-1 rounded-md hover:bg-brand/10 shrink-0 cursor-pointer"
              title="Ver ubicaciones en 3D"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">3D</span>
            </span>
          ) : <span className="w-8" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && product.lots && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="py-3 px-3 bg-elevated/30">
              {/* Section header for lots */}
              <div className="flex items-center gap-2 mb-2 px-2">
                <Layers className="w-3 h-3 text-amber-400/50" />
                <span className="text-[9px] font-bold text-amber-400/40 uppercase tracking-[0.15em]">Lotes ({product.lot_count})</span>
                <div className="flex-1 h-px bg-amber-500/8" />
              </div>
              {product.lots.map((lot) => (
                <LotRow key={lot.lot_id} lot={lot} onOpenLotDetail={onOpenLotDetail} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function StockHierarchyView({
  warehouseFilter,
  onOpenLotDetail,
}: {
  warehouseFilter?: string;
  onOpenLotDetail?: (lotId: string) => void;
}) {
  const [products, setProducts] = useState<StockHierarchyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<StorageUnitStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<StorageUnitType | "all">("all");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expired" | "critical" | "warning" | "ok">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "reserved" | "full">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchStockHierarchy(warehouseFilter);
    startTransition(() => {
      setProducts(data);
      setLoading(false);
    });
  }, [warehouseFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Count active filters
  const activeFilterCount = [statusFilter, typeFilter, expiryFilter, stockFilter].filter((f) => f !== "all").length;

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setExpiryFilter("all");
    setStockFilter("all");
    setSearch("");
  };

  // Helper: days until expiry for a lot
  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    // eslint-disable-next-line
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  // Filter products (deep filter: check lots and SUs within each product)
  const filtered = useMemo(() => {
    return products
      .map((product) => {
        // Text search — match product, lot number, SU code, or vendor
        const q = search.toLowerCase();
        const matchSearch =
          !search ||
          product.product_name.toLowerCase().includes(q) ||
          product.product_sku.toLowerCase().includes(q) ||
          product.lots.some(l =>
            l.lot_number.toLowerCase().includes(q) ||
            (l.vendor_name && l.vendor_name.toLowerCase().includes(q)) ||
            l.storage_units.some(su =>
              su.su_code.toLowerCase().includes(q) ||
              (su.rack_code && su.rack_code.toLowerCase().includes(q))
            )
          );

        if (!matchSearch) return null;

        // Deep filter lots
        const filteredLots = product.lots
          .map((lot) => {
            // Expiry filter on lot level
            if (expiryFilter !== "all" && lot.expiry_date) {
              const days = getDaysUntilExpiry(lot.expiry_date);
              if (days !== null) {
                if (expiryFilter === "expired" && days > 0) return null;
                if (expiryFilter === "critical" && (days <= 0 || days > 30)) return null;
                if (expiryFilter === "warning" && (days <= 30 || days > 90)) return null;
                if (expiryFilter === "ok" && days <= 90) return null;
              }
            } else if (expiryFilter !== "all" && !lot.expiry_date) {
              if (expiryFilter !== "ok") return null;
            }

            // Filter storage units
            const filteredSUs = (lot.storage_units ?? []).filter((su) => {
              if (statusFilter !== "all" && su.status !== statusFilter) return false;
              if (typeFilter !== "all" && su.su_type !== typeFilter) return false;
              return true;
            });

            if (statusFilter !== "all" || typeFilter !== "all") {
              if (filteredSUs.length === 0) return null;
            }

            return { ...lot, storage_units: filteredSUs };
          })
          .filter(Boolean) as StockHierarchyLot[];

        // Stock level filter (on product level)
        if (stockFilter !== "all") {
          const ratio = product.total_available / Math.max(product.total_stock, 1);
          if (stockFilter === "low" && ratio > 0.2) return null;
          if (stockFilter === "reserved" && product.total_reserved === 0) return null;
          if (stockFilter === "full" && ratio <= 0.8) return null;
        }

        if (filteredLots.length === 0 && (expiryFilter !== "all" || statusFilter !== "all" || typeFilter !== "all")) return null;

        return { ...product, lots: filteredLots };
      })
      .filter(Boolean) as StockHierarchyProduct[];
  }, [products, search, statusFilter, typeFilter, expiryFilter, stockFilter]);

  // Compute counts for filter pills
  const counts = useMemo(() => {
    const status: Record<string, number> = { available: 0, reserved: 0, picking: 0, picked: 0, in_transit: 0, empty: 0 };
    const type: Record<string, number> = { palet: 0, tina: 0, caja: 0, contenedor: 0 };
    const expiry = { expired: 0, critical: 0, warning: 0, ok: 0 };
    let lowStock = 0;
    let hasReserved = 0;
    let fullStock = 0;

    for (const p of products) {
      const ratio = p.total_available / Math.max(p.total_stock, 1);
      if (ratio <= 0.2) lowStock++;
      if (p.total_reserved > 0) hasReserved++;
      if (ratio > 0.8) fullStock++;

      for (const lot of p.lots) {
        const days = getDaysUntilExpiry(lot.expiry_date);
        if (days !== null) {
          if (days <= 0) expiry.expired++;
          else if (days <= 30) expiry.critical++;
          else if (days <= 90) expiry.warning++;
          else expiry.ok++;
        } else {
          expiry.ok++;
        }

        for (const su of lot.storage_units ?? []) {
          status[su.status] = (status[su.status] || 0) + 1;
          type[su.su_type] = (type[su.su_type] || 0) + 1;
        }
      }
    }

    return { status, type, expiry, lowStock, hasReserved, fullStock };
  }, [products]);

  // Summary stats
  const totalProducts = products.length;
  const totalSUs = products.reduce((acc, p) => acc + p.su_count, 0);
  const totalStock = products.reduce((acc, p) => acc + p.total_stock, 0);
  const totalReserved = products.reduce((acc, p) => acc + p.total_reserved, 0);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="wms-inventario">
      {/* ── Summary KPIs ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Materiales", value: totalProducts, icon: Package, color: "text-brand" },
          { label: "Unidades Almacén", value: totalSUs, icon: Box, color: "text-cyan-400" },
          { label: "Stock Total", value: totalStock.toLocaleString(), icon: Layers, color: "text-emerald-400" },
          { label: "Reservado", value: totalReserved.toLocaleString(), icon: Clock, color: "text-amber-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
              <kpi.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-lg font-bold text-text-primary tabular-nums">{kpi.value}</div>
              <div className="text-[11px] text-text-muted">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + Filter Toggle ───────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar material, SKU, lote, UA o rack..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50 transition-all"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all ${
            filtersOpen || activeFilterCount > 0
              ? "bg-brand/15 border-brand/30 text-brand"
              : "bg-surface border-border text-text-muted hover:text-text-primary hover:border-brand/20"
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={load}
          className="px-3 py-2.5 bg-surface border border-border rounded-xl text-text-muted hover:text-text-primary hover:border-brand/20 transition-colors"
          title="Recargar"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </button>
      </div>

      {/* ── Filter Panel ───────────────────────────── */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
              {/* Row 1: Status + Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Status filter */}
                <div>
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Estado UA</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "available", "reserved", "picking", "in_transit"] as const).map((s) => {
                      const isActive = statusFilter === s;
                      const count = s === "all" ? totalSUs : (counts.status[s] ?? 0);
                      const label = s === "all" ? "Todos" : SU_STATUS_LABELS[s];
                      const colorMap: Record<string, string> = {
                        all: "border-zinc-600 text-zinc-400",
                        available: "border-emerald-500/40 text-emerald-400",
                        reserved: "border-amber-500/40 text-amber-400",
                        picking: "border-blue-500/40 text-blue-400",
                        in_transit: "border-cyan-500/40 text-cyan-400",
                      };
                      return (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
                            isActive
                              ? `${colorMap[s]} bg-white/5 font-semibold shadow-sm`
                              : "border-border text-text-muted hover:text-text-primary hover:border-brand/20"
                          }`}
                        >
                          {label}
                          <span className={`text-[9px] px-1 py-0.5 rounded ${isActive ? "bg-white/10" : "bg-muted"}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Type filter */}
                <div>
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Tipo UA</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "palet", "tina", "caja", "contenedor"] as const).map((t) => {
                      const isActive = typeFilter === t;
                      const count = t === "all" ? totalSUs : (counts.type[t] ?? 0);
                      const label = t === "all" ? "Todos" : SU_TYPE_LABELS[t];
                      return (
                        <button
                          key={t}
                          onClick={() => setTypeFilter(t)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
                            isActive
                              ? "border-brand/40 text-brand bg-brand/10 font-semibold shadow-sm"
                              : "border-border text-text-muted hover:text-text-primary hover:border-brand/20"
                          }`}
                        >
                          {t !== "all" && <SUTypeIcon type={t} className="w-3 h-3" />}
                          {label}
                          <span className={`text-[9px] px-1 py-0.5 rounded ${isActive ? "bg-brand/15" : "bg-muted"}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: Expiry + Stock Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Expiry filter */}
                <div>
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Vencimiento</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: "all" as const, label: "Todos", color: "border-zinc-600 text-zinc-400" },
                      { key: "expired" as const, label: "Vencidos", color: "border-red-500/40 text-red-400" },
                      { key: "critical" as const, label: "< 30 días", color: "border-amber-500/40 text-amber-400" },
                      { key: "warning" as const, label: "< 90 días", color: "border-yellow-500/40 text-yellow-400" },
                      { key: "ok" as const, label: "Vigente", color: "border-emerald-500/40 text-emerald-400" },
                    ]).map(({ key, label, color }) => {
                      const isActive = expiryFilter === key;
                      const count = key === "all"
                        ? products.reduce((a, p) => a + p.lots.length, 0)
                        : counts.expiry[key];
                      return (
                        <button
                          key={key}
                          onClick={() => setExpiryFilter(key)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
                            isActive
                              ? `${color} bg-white/5 font-semibold shadow-sm`
                              : "border-border text-text-muted hover:text-text-primary hover:border-brand/20"
                          }`}
                        >
                          {key === "expired" && <AlertTriangle className="w-3 h-3" />}
                          {label}
                          <span className={`text-[9px] px-1 py-0.5 rounded ${isActive ? "bg-white/10" : "bg-muted"}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stock level filter */}
                <div>
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Nivel de Stock</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: "all" as const, label: "Todos", color: "border-zinc-600 text-zinc-400", count: totalProducts },
                      { key: "low" as const, label: "Bajo (≤20%)", color: "border-red-500/40 text-red-400", count: counts.lowStock },
                      { key: "reserved" as const, label: "Con Reserva", color: "border-amber-500/40 text-amber-400", count: counts.hasReserved },
                      { key: "full" as const, label: "Alto (>80%)", color: "border-emerald-500/40 text-emerald-400", count: counts.fullStock },
                    ]).map(({ key, label, color, count }) => {
                      const isActive = stockFilter === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setStockFilter(key)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
                            isActive
                              ? `${color} bg-white/5 font-semibold shadow-sm`
                              : "border-border text-text-muted hover:text-text-primary hover:border-brand/20"
                          }`}
                        >
                          {label}
                          <span className={`text-[9px] px-1 py-0.5 rounded ${isActive ? "bg-white/10" : "bg-muted"}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-text-muted hover:text-brand transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results count ──────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Filter className="w-3 h-3" />
          <span>
            Mostrando <span className="font-semibold text-text-primary">{filtered.length}</span> de {totalProducts} materiales
          </span>
        </div>
      )}

      {/* ── Product List ──────────────────────────── */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No se encontraron materiales con stock</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-2 text-xs text-brand hover:text-brand-light transition-colors">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          filtered.map((product, idx) => (
            <ProductRow
              key={product.product_id}
              product={product}
              defaultExpanded={idx === 0}
              onOpenLotDetail={onOpenLotDetail}
            />
          ))
        )}
      </div>
    </div>
  );
}
