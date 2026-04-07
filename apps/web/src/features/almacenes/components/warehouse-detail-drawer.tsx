"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Layers,
  Package,
  Box,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  AlertTriangle,
  Thermometer,
  Warehouse as WarehouseIcon,
  Hash,
  Tag,
  Grid3x3,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchWarehouseRacksForPreview } from "../actions/stock-hierarchy-actions";
import type { MiniRack, MiniRackPosition } from "../actions/stock-hierarchy-actions";

// ─── Status Configs ─────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  occupied: { label: "Ocupado", color: "#10B981", bg: "bg-emerald-500/10" },
  active:   { label: "Activo",  color: "#10B981", bg: "bg-emerald-500/10" },
  empty:    { label: "Vacío",   color: "#71717A", bg: "bg-zinc-500/10" },
  reserved: { label: "Reservado", color: "#3B82F6", bg: "bg-blue-500/10" },
  blocked:  { label: "Bloqueado", color: "#EF4444", bg: "bg-red-500/10" },
  expired:  { label: "Vencido", color: "#F97316", bg: "bg-orange-500/10" },
  quarantine: { label: "Cuarentena", color: "#A855F7", bg: "bg-purple-500/10" },
};

const TYPE_CFG: Record<string, { label: string; icon: typeof WarehouseIcon; color: string }> = {
  standard:      { label: "Estándar", icon: WarehouseIcon, color: "text-indigo-500" },
  cross_docking: { label: "Cross-Docking", icon: Layers, color: "text-amber-500" },
  cold_storage:  { label: "Cámara Fría", icon: Thermometer, color: "text-cyan-500" },
};

type WarehouseDetailDrawerProps = {
  warehouseId: string;
  warehouseName: string;
  warehouseType: string;
  warehouseLocation: string | null;
  occupancy: number;
  totalPositions: number;
  occupiedPositions: number;
  rackCount: number;
  onClose: () => void;
};

// ─── Position Detail Inline ─────────────────────────────
function PositionDetailPanel({
  pos,
  rackCode,
  rack,
  onBack,
}: {
  pos: MiniRackPosition;
  rackCode: string;
  rack: MiniRack;
  onBack: () => void;
}) {
  const stCfg = STATUS_CFG[pos.status || "occupied"] || STATUS_CFG.occupied;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="px-4 pb-4"
    >
      {/* Nav & Header */}
      <div className="flex items-center gap-2 mb-3 pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-text-muted hover:text-text-primary hover:bg-muted transition-colors"
        >
          <ArrowLeft size={12} />
          {rackCode}
        </button>
        <ChevronRight size={10} className="text-text-muted" />
        <span className="text-[10px] font-semibold text-text-primary">
          F{pos.row_number} C{pos.column_number}
        </span>
      </div>

      {/* Status & Quantity header */}
      <div className="flex items-center justify-between mb-4">
        <div
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold"
          style={{ color: stCfg.color, backgroundColor: stCfg.color + "18" }}
        >
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stCfg.color }} />
          {stCfg.label}
        </div>
        {pos.su_quantity != null && (
          <div className="text-right">
            <span className="text-xl font-black tabular-nums text-text-primary">{pos.su_quantity}</span>
            <span className="text-[10px] text-text-muted ml-1">UN</span>
          </div>
        )}
      </div>

      {/* Product Info Fields */}
      {pos.product_name ? (
        <div className="rounded-xl border border-border bg-primary overflow-hidden">
          {[
            { icon: Package, label: "Producto", value: pos.product_name },
            { icon: Hash, label: "SKU", value: pos.product_sku || "—" },
            { icon: Box, label: "UA Código", value: pos.su_code || "—" },
            { icon: Tag, label: "Tipo UA", value: pos.su_type || "—" },
            { icon: Layers, label: "Lote", value: pos.lot_number || "—" },
            { icon: Grid3x3, label: "Posición", value: `Fila ${pos.row_number}, Columna ${pos.column_number}` },
          ].map((f, idx) => (
            <div key={f.label} className={cn("flex items-center gap-3 px-4 py-3", idx > 0 && "border-t border-border")}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/8 shrink-0">
                <f.icon size={14} className="text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-text-muted">{f.label}</p>
                <p className="text-[12px] font-semibold text-text-primary truncate">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-text-muted">
          <Package size={28} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">Posición Ocupada</p>
          <p className="text-[10px] mt-1">Sin detalle de producto asignado</p>
        </div>
      )}

      {/* Mini rack context map — highlight selected position */}
      <div className="mt-4 rounded-xl border border-border bg-primary p-3">
        <p className="text-[8px] font-semibold uppercase tracking-widest text-text-muted mb-2">Ubicación en Rack {rackCode}</p>
        <div
          className="grid gap-[3px] mx-auto max-w-[280px]"
          style={{ gridTemplateColumns: `repeat(${rack.columns}, 1fr)` }}
        >
          {Array.from({ length: rack.rows * rack.columns }, (_, idx) => {
            const row = Math.floor(idx / rack.columns) + 1;
            const col = (idx % rack.columns) + 1;
            const p = rack.rack_positions.find(rp => rp.row_number === row && rp.column_number === col);
            const hasProduct = p?.su_code;
            const isSelected = p?.id === pos.id;
            const cfg = STATUS_CFG[p?.status || "empty"] || STATUS_CFG.empty;
            return (
              <div
                key={idx}
                className={cn(
                  "aspect-square rounded-[3px] flex items-center justify-center transition-all",
                  isSelected && "ring-2 ring-brand ring-offset-1 ring-offset-surface scale-110 z-10"
                )}
                style={{
                  backgroundColor: hasProduct ? cfg.color + (isSelected ? "50" : "20") : "var(--muted)",
                  opacity: isSelected ? 1 : hasProduct ? 0.6 : 0.3,
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-[2px]"
                  style={{ backgroundColor: isSelected ? cfg.color : hasProduct ? cfg.color + "80" : "var(--border)" }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Rack Accordion ─────────────────────────────────────
function RackRow({ rack, defaultOpen }: { rack: MiniRack; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [selectedPos, setSelectedPos] = useState<MiniRackPosition | null>(null);
  const occupied = rack.rack_positions.filter(p => p.status === "occupied" || p.su_code).length;
  const total = rack.rows * rack.columns;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const pctColor = pct > 85 ? "text-red-500" : pct > 60 ? "text-amber-500" : "text-emerald-500";

  // Group products
  const productsInRack = rack.rack_positions
    .filter(p => p.product_name)
    .reduce((acc, p) => {
      const key = p.product_sku || p.product_name!;
      if (!acc[key]) {
        acc[key] = { name: p.product_name!, sku: p.product_sku || "", qty: 0, positions: 0, lots: new Set<string>() };
      }
      acc[key].qty += p.su_quantity || 0;
      acc[key].positions += 1;
      if (p.lot_number) acc[key].lots.add(p.lot_number);
      return acc;
    }, {} as Record<string, { name: string; sku: string; qty: number; positions: number; lots: Set<string> }>);

  const productsList = Object.values(productsInRack).sort((a, b) => b.qty - a.qty);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => { setOpen(!open); setSelectedPos(null); }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        {open ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted shrink-0" />}
        <span className="font-mono text-xs font-bold text-text-primary">{rack.code}</span>
        <span className="text-[10px] text-text-muted">{rack.rows}×{rack.columns}</span>
        <div className="flex-1" />
        {/* Mini occupancy bar */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: pct > 85 ? "#EF4444" : pct > 60 ? "#F59E0B" : "#10B981",
              }}
            />
          </div>
          <span className={cn("text-[10px] font-bold tabular-nums", pctColor)}>{pct}%</span>
          <span className="text-[10px] text-text-muted">{occupied}/{total}</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {selectedPos ? (
                <PositionDetailPanel
                  key="detail"
                  pos={selectedPos}
                  rackCode={rack.code}
                  rack={rack}
                  onBack={() => setSelectedPos(null)}
                />
              ) : (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="px-4 pb-4 space-y-3"
                >
                  {/* Clickable Position grid */}
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                      Mapa de Posiciones <span className="text-brand/60 normal-case">· Clic para detalle</span>
                    </p>
                    <div
                      className="grid gap-[3px] mx-auto max-w-sm"
                      style={{ gridTemplateColumns: `repeat(${rack.columns}, 1fr)` }}
                    >
                      {Array.from({ length: rack.rows * rack.columns }, (_, idx) => {
                        const row = Math.floor(idx / rack.columns) + 1;
                        const col = (idx % rack.columns) + 1;
                        const pos = rack.rack_positions.find(p => p.row_number === row && p.column_number === col);
                        const hasProduct = pos?.su_code || pos?.status === "occupied";
                        const cfg = STATUS_CFG[pos?.status || "empty"] || STATUS_CFG.empty;
                        return (
                          <button
                            key={idx}
                            onClick={() => { if (pos && hasProduct) setSelectedPos(pos); }}
                            disabled={!hasProduct}
                            className={cn(
                              "group relative aspect-square rounded-[4px] flex items-center justify-center transition-all",
                              hasProduct && "cursor-pointer hover:ring-2 hover:ring-brand/40 hover:scale-110 hover:z-10",
                              !hasProduct && "cursor-default"
                            )}
                            style={{ backgroundColor: hasProduct ? cfg.color + "25" : "var(--muted)" }}
                            title={hasProduct ? `${pos?.product_name || "Ocupado"} · Clic` : `Vacío (${row}-${col})`}
                          >
                            <div
                              className={cn("w-2.5 h-2.5 rounded-[2px] transition-all", hasProduct && "group-hover:scale-125")}
                              style={{ backgroundColor: hasProduct ? cfg.color : "var(--border)" }}
                            />
                            {/* Tooltip on hover */}
                            {hasProduct && (
                              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 hidden group-hover:block">
                                <div className="whitespace-nowrap rounded-lg bg-elevated border border-border px-2.5 py-1.5 text-[9px] shadow-lg">
                                  <p className="font-semibold text-text-primary">{pos?.product_name || "Ocupado"}</p>
                                  <p className="text-text-muted">{pos?.product_sku} · {pos?.su_quantity} uds</p>
                                  {pos?.lot_number && <p className="text-brand">Lote: {pos.lot_number}</p>}
                                  <p className="text-brand/60 mt-0.5">Clic para ver detalle →</p>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-1 px-0.5">
                      <span className="text-[7px] text-text-muted">F1</span>
                      <span className="text-[7px] text-text-muted">Filas ↓ · Columnas →</span>
                      <span className="text-[7px] text-text-muted">F{rack.rows}</span>
                    </div>
                  </div>

                  {/* Products in this rack */}
                  {productsList.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">
                        Productos · {productsList.length}
                      </p>
                      {productsList.map(p => (
                        <div key={p.sku} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                          <Package size={12} className="text-brand shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-text-primary truncate">{p.name}</p>
                            <p className="text-[9px] text-text-muted">{p.sku} · {p.lots.size} lote{p.lots.size !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold tabular-nums text-text-primary">{p.qty.toLocaleString()}</p>
                            <p className="text-[9px] text-text-muted">{p.positions} pos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {productsList.length === 0 && (
                    <p className="text-center text-[10px] text-text-muted py-2">Sin productos en este rack</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────
export function WarehouseDetailDrawer({
  warehouseId,
  warehouseName,
  warehouseType,
  warehouseLocation,
  occupancy,
  totalPositions,
  occupiedPositions,
  rackCount,
  onClose,
}: WarehouseDetailDrawerProps) {
  const [racks, setRacks] = useState<MiniRack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Fetch rack data
  useEffect(() => {
    setLoading(true);
    fetchWarehouseRacksForPreview(warehouseId)
      .then(res => {
        setRacks(res.racks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [warehouseId]);

  // Aggregate all products across racks
  const allProducts = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; totalQty: number; positions: number; racks: Set<string>; lots: Set<string> }>();
    for (const rack of racks) {
      for (const pos of rack.rack_positions) {
        if (!pos.product_name || !pos.su_code) continue;
        const key = pos.product_sku || pos.product_name;
        if (!map.has(key)) {
          map.set(key, { name: pos.product_name, sku: pos.product_sku || "", totalQty: 0, positions: 0, racks: new Set(), lots: new Set() });
        }
        const entry = map.get(key)!;
        entry.totalQty += pos.su_quantity || 0;
        entry.positions += 1;
        entry.racks.add(rack.code);
        if (pos.lot_number) entry.lots.add(pos.lot_number);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [racks]);

  // Filter racks by search
  const filteredRacks = useMemo(() => {
    if (!search) return racks;
    const q = search.toLowerCase();
    return racks.filter(r =>
      r.code.toLowerCase().includes(q) ||
      r.rack_positions.some(p =>
        p.product_name?.toLowerCase().includes(q) ||
        p.product_sku?.toLowerCase().includes(q) ||
        p.lot_number?.toLowerCase().includes(q)
      )
    );
  }, [racks, search]);

  const typeCfg = TYPE_CFG[warehouseType] || TYPE_CFG.standard;
  const TypeIcon = typeCfg.icon;
  const emptyPositions = totalPositions - occupiedPositions;
  const occColor = occupancy > 85 ? "text-red-500" : occupancy > 60 ? "text-amber-500" : "text-emerald-500";

  return (
    <motion.div
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-5 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted", typeCfg.color)}>
              <TypeIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">{warehouseName}</h2>
              <p className="text-[10px] text-text-muted">
                {typeCfg.label}{warehouseLocation && ` · ${warehouseLocation}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* KPI row */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Racks", value: rackCount, icon: Layers },
            { label: "Posiciones", value: totalPositions, icon: Box },
            { label: "Ocupadas", value: occupiedPositions, icon: Package },
            { label: "Disponibles", value: emptyPositions, icon: AlertTriangle },
          ].map(k => (
            <div key={k.label} className="rounded-lg border border-border bg-primary p-2 text-center">
              <k.icon size={12} className="mx-auto text-text-muted" />
              <p className="mt-1 text-sm font-bold tabular-nums text-text-primary">{k.value.toLocaleString()}</p>
              <p className="text-[8px] text-text-muted">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Occupancy bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${occupancy}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ backgroundColor: occupancy > 85 ? "#EF4444" : occupancy > 60 ? "#F59E0B" : "#10B981" }}
            />
          </div>
          <span className={cn("text-xs font-bold tabular-nums", occColor)}>{occupancy}%</span>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar rack, producto o lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-primary py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              <p className="text-xs text-text-muted">Cargando inventario...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Products summary section */}
            {allProducts.length > 0 && (
              <div className="border-b border-border px-5 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Resumen de Materiales · {allProducts.length} producto{allProducts.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {allProducts.slice(0, 15).map(p => (
                    <div key={p.sku} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10">
                        <Package size={13} className="text-brand" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-text-primary truncate">{p.name}</p>
                        <p className="text-[9px] text-text-muted">
                          {p.sku} · {p.racks.size} rack{p.racks.size !== 1 ? "s" : ""} · {p.lots.size} lote{p.lots.size !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold tabular-nums text-text-primary">{p.totalQty.toLocaleString()}</p>
                        <p className="text-[9px] text-text-muted">{p.positions} pos</p>
                      </div>
                    </div>
                  ))}
                  {allProducts.length > 15 && (
                    <p className="text-center text-[10px] text-text-muted pt-1">
                      +{allProducts.length - 15} productos más
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Rack accordion */}
            <div>
              <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-2.5 flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">
                  Racks · {filteredRacks.length} de {racks.length}
                </p>
                <div className="flex gap-1.5">
                  {Object.entries(STATUS_CFG)
                    .filter(([k]) => k !== "active" && k !== "quarantine" && k !== "expired")
                    .map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: cfg.color }} />
                      <span className="text-[8px] text-text-muted">{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {filteredRacks.length === 0 && (
                <div className="py-12 text-center">
                  <Search size={24} className="mx-auto text-text-muted/30 mb-2" />
                  <p className="text-xs text-text-muted">No se encontraron racks</p>
                </div>
              )}
              {filteredRacks.map((rack, i) => (
                <RackRow key={rack.id} rack={rack} defaultOpen={i === 0 && filteredRacks.length <= 5} />
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
