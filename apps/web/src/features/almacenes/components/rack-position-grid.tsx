"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Grid3X3, MapPin, Package, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ── Types ─────────────────────────────────────────────
type PositionData = {
  id: string;
  row_number: number;
  column_number: number;
  status: "available" | "occupied" | "reserved" | "blocked";
  product_name?: string | null;
  product_sku?: string | null;
  quantity?: number | null;
  lot_number?: string | null;
};

type RackData = {
  id: string;
  code: string;
  positions: PositionData[];
  rows: number;
  columns: number;
};

type RackPositionGridProps = {
  warehouseId: string;
  selectedPositionId?: string;
  suggestedPositionId?: string;
  onSelectPosition: (position: { id: string; label: string }) => void;
  onRackSelect?: (rackCode: string) => void;
  compact?: boolean;
};

const STATUS_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  available: { bg: "bg-emerald-500/20", border: "border-emerald-500/40", label: "Libre" },
  occupied: { bg: "bg-blue-500/20", border: "border-blue-500/40", label: "Ocupado" },
  reserved: { bg: "bg-amber-500/20", border: "border-amber-500/40", label: "Reservado" },
  blocked: { bg: "bg-red-500/20", border: "border-red-500/40", label: "Bloqueado" },
};

// ── Component ─────────────────────────────────────────
export function RackPositionGrid({
  warehouseId,
  selectedPositionId,
  suggestedPositionId,
  onSelectPosition,
  onRackSelect,
  compact = false,
}: RackPositionGridProps) {
  const [racks, setRacks] = useState<RackData[]>([]);
  const [selectedRackId, setSelectedRackId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hoveredPosition, setHoveredPosition] = useState<PositionData | null>(null);

  // Fetch racks and positions for the warehouse
  useEffect(() => {
    if (!warehouseId) return;

    (async function loadRacks() {
      setLoading(true);
      try {
        const resp = await fetch(`/api/wms/rack-positions?warehouseId=${warehouseId}`);
        const res = await resp.json();
        if (res.success && res.data) {
          setRacks(res.data as RackData[]);
          if (res.data.length > 0 && !selectedRackId) {
            setSelectedRackId((res.data as RackData[])[0].id);
          }
        }
      } catch (err) {
        console.error("[RackGrid] Error loading racks:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [warehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRack = racks.find(r => r.id === selectedRackId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-text-muted">
          <Grid3X3 size={16} className="animate-pulse" />
          <span className="text-xs">Cargando posiciones del rack...</span>
        </div>
      </div>
    );
  }

  if (racks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <MapPin size={20} className="mx-auto mb-2 text-text-muted opacity-40" />
        <p className="text-xs text-text-muted">No hay racks disponibles en este almacén</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top-Down Warehouse Map */}
      <div className="rounded-xl border border-border bg-[#0d0f1e] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Grid3X3 size={12} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">Mapa del Almacén</span>
            <span className="text-[9px] text-text-muted">({racks.length} racks)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-emerald-500/40 border border-emerald-500/60" />
              <span className="text-[8px] text-zinc-400">Con libres</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-indigo-500/30 border border-indigo-500/40" />
              <span className="text-[8px] text-zinc-400">Lleno</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-emerald-400 border border-emerald-300" />
              <span className="text-[8px] text-zinc-400">Seleccionado</span>
            </div>
          </div>
        </div>
        <div className="grid gap-1" style={{
          gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(racks.length * 1.5)), 12)}, 1fr)`
        }}>
          {racks.map(rack => {
            const availCount = rack.positions.filter(p => p.status === "available").length;
            const isActive = rack.id === selectedRackId;
            const hasAvailable = availCount > 0;
            return (
              <button
                key={rack.id}
                onClick={() => { setSelectedRackId(rack.id); onRackSelect?.(rack.code); }}
                className={cn(
                  "relative rounded-md border px-1 py-1.5 text-center transition-all hover:scale-105",
                  isActive
                    ? "bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                    : hasAvailable
                    ? "bg-emerald-500/[0.06] border-emerald-500/30 hover:border-emerald-400/50 hover:bg-emerald-500/10"
                    : "bg-indigo-500/[0.04] border-indigo-500/20 hover:border-indigo-400/30 opacity-60"
                )}
              >
                <p className={cn(
                  "text-[8px] font-mono font-bold leading-none",
                  isActive ? "text-emerald-300" : hasAvailable ? "text-emerald-400/80" : "text-indigo-400/60"
                )}>
                  {rack.code}
                </p>
                <p className={cn(
                  "text-[7px] mt-0.5 leading-none",
                  isActive ? "text-emerald-200" : "text-zinc-500"
                )}>
                  {availCount}/{rack.positions.length}
                </p>
                {isActive && (
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rack Selector Dropdown (fallback) */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted shrink-0">
          Rack:
        </label>
        <div className="relative flex-1">
          <select
            value={selectedRackId}
            onChange={(e) => setSelectedRackId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-mono text-text-primary focus:border-emerald-500 focus:outline-none"
          >
            {racks.map(r => {
              const avail = r.positions.filter(p => p.status === "available").length;
              return (
                <option key={r.id} value={r.id}>
                  {r.code} — {avail}/{r.positions.length} libre{avail !== 1 ? "s" : ""}
                </option>
              );
            })}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Grid Visual */}
      {activeRack && (
        <motion.div
          key={activeRack.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-border bg-surface p-3"
        >
          {/* Grid Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Grid3X3 size={12} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-text-primary font-mono">{activeRack.code}</span>
              <span className="text-[9px] text-text-muted">
                {activeRack.rows}×{activeRack.columns} posiciones
              </span>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2">
              {Object.entries(STATUS_COLORS).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className={cn("h-2 w-2 rounded-sm", config.bg, "border", config.border)} />
                  <span className="text-[8px] text-text-muted">{config.label}</span>
                </div>
              ))}
              {suggestedPositionId && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-sm bg-yellow-400/30 border border-yellow-400 ring-1 ring-yellow-400/50" />
                  <span className="text-[8px] text-text-muted">Sugerido</span>
                </div>
              )}
            </div>
          </div>

          {/* Grid Body */}
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `auto repeat(${activeRack.columns}, 1fr)`,
            }}
          >
            {/* Column headers */}
            <div /> {/* empty corner cell */}
            {Array.from({ length: activeRack.columns }, (_, c) => (
              <div key={`col-${c}`} className="text-center text-[8px] font-mono text-text-muted py-0.5">
                C{c + 1}
              </div>
            ))}

            {/* Rows */}
            {Array.from({ length: activeRack.rows }, (_, r) => (
              <>
                {/* Row label */}
                <div key={`row-label-${r}`} className="flex items-center justify-center text-[8px] font-mono text-text-muted pr-1">
                  F{r + 1}
                </div>
                {/* Cells */}
                {Array.from({ length: activeRack.columns }, (_, c) => {
                  const pos = activeRack.positions.find(
                    p => p.row_number === r + 1 && p.column_number === c + 1
                  );
                  if (!pos) {
                    return (
                      <div key={`empty-${r}-${c}`} className="h-7 rounded-sm bg-muted/30 border border-dashed border-border/30" />
                    );
                  }

                  const statusCfg = STATUS_COLORS[pos.status] || STATUS_COLORS.available;
                  const isSelected = selectedPositionId === pos.id;
                  const isSuggested = suggestedPositionId === pos.id;
                  const isClickable = pos.status === "available" || isSelected;

                  return (
                    <motion.button
                      key={pos.id}
                      onClick={() => {
                        if (isClickable) {
                          onSelectPosition({
                            id: pos.id,
                            label: `${activeRack.code}-${pos.row_number}-${pos.column_number}`,
                          });
                        }
                      }}
                      onMouseEnter={() => setHoveredPosition(pos)}
                      onMouseLeave={() => setHoveredPosition(null)}
                      disabled={!isClickable}
                      whileHover={isClickable ? { scale: 1.1 } : undefined}
                      whileTap={isClickable ? { scale: 0.95 } : undefined}
                      className={cn(
                        "relative h-7 rounded-sm border transition-all",
                        statusCfg.bg,
                        statusCfg.border,
                        isSelected && "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/30",
                        isSuggested && !isSelected && "ring-2 ring-yellow-400 border-yellow-400 animate-pulse",
                        isClickable && !isSelected && "cursor-pointer hover:brightness-125",
                        !isClickable && "cursor-not-allowed opacity-60",
                        compact && "h-5",
                      )}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <MapPin size={compact ? 8 : 10} className="text-emerald-500" />
                        </div>
                      )}
                      {isSuggested && !isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[7px] font-bold text-yellow-500">★</span>
                        </div>
                      )}
                      {pos.status === "occupied" && !isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Package size={compact ? 6 : 8} className="text-blue-400/60" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </>
            ))}
          </div>

          {/* Tooltip */}
          {hoveredPosition && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 rounded-lg border border-border bg-primary p-2 text-[10px]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-text-primary">
                  {activeRack.code}-{hoveredPosition.row_number}-{hoveredPosition.column_number}
                </span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
                  STATUS_COLORS[hoveredPosition.status]?.bg,
                  STATUS_COLORS[hoveredPosition.status]?.border ? `border ${STATUS_COLORS[hoveredPosition.status].border}` : "",
                )}>
                  {STATUS_COLORS[hoveredPosition.status]?.label}
                </span>
              </div>
              {hoveredPosition.product_name && (
                <div className="mt-1 text-text-secondary">
                  <span className="font-medium">{hoveredPosition.product_name}</span>
                  {hoveredPosition.product_sku && (
                    <span className="text-text-muted ml-1 font-mono">[{hoveredPosition.product_sku}]</span>
                  )}
                  {hoveredPosition.quantity != null && (
                    <span className="ml-1">{hoveredPosition.quantity} UN</span>
                  )}
                  {hoveredPosition.lot_number && (
                    <span className="text-text-muted ml-1">Lote: {hoveredPosition.lot_number}</span>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
