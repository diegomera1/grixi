"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Box,
  Layers,
  AlertTriangle,
  Package,
  Grid3x3,
  Cuboid,
  BarChart3,
  Clock,
  Thermometer,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

// Dynamic import for 3D scene (no SSR)
const Warehouse3DScene = dynamic(
  () => import("./warehouse-3d").then((mod) => mod.Warehouse3DScene),
  { ssr: false, loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Cuboid size={48} className="mx-auto mb-3 animate-pulse text-[var(--brand)]" />
        <p className="text-sm text-[var(--text-muted)]">Cargando escena 3D...</p>
      </div>
    </div>
  )}
);

// ─── Types ──────────────────────────────────────────────

type Position = {
  id: string;
  row_number: number;
  column_number: number;
  status: string;
  max_weight: number;
  inventory: {
    id: string;
    product_name: string;
    product_sku: string;
    category: string;
    lot_number: string | null;
    batch_code: string | null;
    quantity: number;
    entry_date: string | null;
    expiry_date: string | null;
    supplier: string | null;
    status: string;
  } | null;
};

type Rack = {
  id: string;
  code: string;
  rack_type: string;
  rows: number;
  columns: number;
  aisle: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  dimensions: { width: number; height: number; depth: number };
  rack_positions: Position[];
};

type Warehouse = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  dimensions: { width: number; depth: number; height: number };
};

type WarehouseDetailProps = {
  warehouse: Warehouse;
  racks: Rack[];
  stats: {
    totalRacks: number;
    totalPositions: number;
    occupiedPositions: number;
    occupancy: number;
    expiredCount: number;
    expiringCount: number;
    productsCount: number;
  };
};

// ─── Status Colors ──────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  occupied: { label: "Ocupado", color: "#10B981", bg: "rgba(16,185,129,0.15)" },
  empty: { label: "Vacío", color: "#D4D4D8", bg: "rgba(212,212,216,0.15)" },
  reserved: { label: "Reservado", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  blocked: { label: "Bloqueado", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  expired: { label: "Vencido", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  quarantine: { label: "Cuarentena", color: "#7C3AED", bg: "rgba(124,58,237,0.15)" },
  active: { label: "Activo", color: "#10B981", bg: "rgba(16,185,129,0.15)" },
};

const warehouseTypeLabels: Record<string, string> = {
  standard: "Estantería Alta",
  cross_docking: "Cross-Docking",
  cold_storage: "Cámara Fría",
};

function getPositionStatus(pos: Position): string {
  if (pos.inventory?.status === "expired") return "expired";
  if (pos.inventory?.status === "quarantine") return "quarantine";
  return pos.status;
}

// ─── Component ──────────────────────────────────────────

export function WarehouseDetail({ warehouse, racks, stats }: WarehouseDetailProps) {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/almacenes"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} />
          Volver a Almacenes
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand)] shadow-md shadow-[var(--brand)]/20">
                <Box size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{warehouse.name}</h2>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {warehouseTypeLabels[warehouse.type] || warehouse.type}
                  {warehouse.location && ` · ${warehouse.location}`}
                </p>
              </div>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
            <button
              onClick={() => setViewMode("2d")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-all",
                viewMode === "2d"
                  ? "bg-[var(--bg-muted)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <Grid3x3 size={13} />
              Vista 2D
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                viewMode === "3d"
                  ? "bg-[var(--brand)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <Cuboid size={13} />
              Vista 3D
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Racks", value: stats.totalRacks, icon: Layers, color: "var(--brand)" },
          { label: "Posiciones", value: stats.totalPositions, icon: Grid3x3, color: "var(--info)" },
          { label: "Ocupadas", value: stats.occupiedPositions, icon: Package, color: "var(--success)" },
          { label: "Ocupación", value: `${stats.occupancy}%`, icon: BarChart3, color: "var(--brand)" },
          { label: "Vencidos", value: stats.expiredCount, icon: AlertTriangle, color: "var(--error)" },
          { label: "Por vencer", value: stats.expiringCount, icon: Clock, color: "var(--warning)" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5"
          >
            <s.icon size={12} style={{ color: s.color }} />
            <p className="mt-1.5 text-base font-bold tabular-nums text-[var(--text-primary)]">{s.value}</p>
            <p className="text-[9px] text-[var(--text-muted)]">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Visualization area */}
        <div className="flex-1">
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <AnimatePresence mode="wait">
              {viewMode === "2d" ? (
                <motion.div
                  key="2d"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6"
                >
                  {/* Legend */}
                  <div className="mb-6 flex flex-wrap items-center gap-4">
                    {Object.entries(statusConfig).slice(0, 6).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: cfg.color }} />
                        <span className="text-[11px] text-[var(--text-muted)]">{cfg.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Racks grid */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {racks.map((rack) => (
                      <motion.button
                        key={rack.id}
                        onClick={() => setSelectedRack(rack)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "group rounded-lg border p-2 text-left transition-all",
                          selectedRack?.id === rack.id
                            ? "border-[var(--text-muted)]/30 bg-[var(--bg-muted)] shadow-sm"
                            : "border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--text-muted)]/20 hover:shadow-sm"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                            {rack.code}
                          </span>
                          {rack.aisle && (
                            <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                              Pasillo {rack.aisle}
                            </span>
                          )}
                        </div>

                        {/* Mini grid of positions */}
                        <div
                          className="grid gap-[2px]"
                          style={{
                            gridTemplateColumns: `repeat(${rack.columns}, 1fr)`,
                          }}
                        >
                          {Array.from({ length: rack.rows * rack.columns }, (_, idx) => {
                            const row = Math.floor(idx / rack.columns) + 1;
                            const col = (idx % rack.columns) + 1;
                            const pos = rack.rack_positions.find(
                              (p) => p.row_number === row && p.column_number === col
                            );
                            const status = pos ? getPositionStatus(pos) : "empty";
                            const cfg = statusConfig[status] || statusConfig.empty;
                            return (
                              <div
                                key={idx}
                                className="aspect-square rounded-[3px] transition-all group-hover:scale-105"
                                style={{ backgroundColor: cfg.color }}
                                title={pos?.inventory?.product_name || status}
                              />
                            );
                          })}
                        </div>

                        <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                          {rack.rack_positions.filter((p) => p.status === "occupied").length}/
                          {rack.rows * rack.columns} ocupadas
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="3d"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-[600px]"
                >
                  <Warehouse3DScene
                    racks={racks}
                    warehouse={warehouse}
                    onRackSelect={(rack) => setSelectedRack(rack as unknown as Rack)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Rack detail sidebar */}
        <AnimatePresence>
          {selectedRack && (
            <motion.div
              initial={{ opacity: 0, x: 24, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 340 }}
              exit={{ opacity: 0, x: 24, width: 0 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="h-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
                {/* Rack header */}
                <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-mono text-base font-bold text-[var(--text-primary)]">
                        Rack {selectedRack.code}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        {selectedRack.rows} filas × {selectedRack.columns} columnas
                        {selectedRack.aisle && ` · Pasillo ${selectedRack.aisle}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedRack(null)}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)]"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Position grid detailed */}
                <div className="space-y-1 p-4">
                  {Array.from({ length: selectedRack.rows }, (_, rowIdx) => {
                    const row = rowIdx + 1;
                    return (
                      <div key={row} className="flex items-center gap-1">
                        <span className="w-4 text-center text-[9px] font-medium text-[var(--text-muted)]">
                          {row}
                        </span>
                        <div className="flex flex-1 gap-1">
                          {Array.from({ length: selectedRack.columns }, (_, colIdx) => {
                            const col = colIdx + 1;
                            const pos = selectedRack.rack_positions.find(
                              (p) => p.row_number === row && p.column_number === col
                            );
                            const status = pos ? getPositionStatus(pos) : "empty";
                            const cfg = statusConfig[status] || statusConfig.empty;
                            return (
                              <div
                                key={col}
                                className="group relative flex-1 cursor-pointer rounded-md p-1.5 transition-all hover:ring-2 hover:ring-[var(--brand)]/30"
                                style={{ backgroundColor: cfg.bg }}
                              >
                                <div
                                  className="mx-auto h-3 w-3 rounded-sm"
                                  style={{ backgroundColor: cfg.color }}
                                />
                                {/* Tooltip */}
                                {pos?.inventory && (
                                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-48 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-lg group-hover:block">
                                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                                      {pos.inventory.product_name}
                                    </p>
                                    <p className="font-mono text-[10px] text-[var(--brand)]">
                                      {pos.inventory.product_sku}
                                    </p>
                                    <div className="mt-2 space-y-1 text-[10px] text-[var(--text-muted)]">
                                      <p>Cant: {pos.inventory.quantity} {pos.inventory.category}</p>
                                      {pos.inventory.lot_number && <p>Lote: {pos.inventory.lot_number}</p>}
                                      {pos.inventory.supplier && <p>Prov: {pos.inventory.supplier}</p>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Products in this rack */}
                <div className="border-t border-[var(--border)] p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Productos en este rack
                  </h4>
                  <div className="space-y-2">
                    {selectedRack.rack_positions
                      .filter((p) => p.inventory)
                      .slice(0, 8)
                      .map((pos) => {
                        const inv = pos.inventory!;
                        const invStatus = statusConfig[inv.status] || statusConfig.active;
                        return (
                          <div
                            key={pos.id}
                            className="rounded-lg bg-[var(--bg-muted)]/50 p-2.5"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-xs font-medium text-[var(--text-primary)]">
                                  {inv.product_name}
                                </p>
                                <p className="font-mono text-[10px] text-[var(--brand)]">{inv.product_sku}</p>
                              </div>
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                style={{ backgroundColor: invStatus.bg, color: invStatus.color }}
                              >
                                {invStatus.label}
                              </span>
                            </div>
                            <div className="mt-1.5 flex gap-3 text-[10px] text-[var(--text-muted)]">
                              <span>Pos: {pos.row_number}-{pos.column_number}</span>
                              <span>Cant: {inv.quantity}</span>
                              {inv.lot_number && <span>Lote: {inv.lot_number}</span>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
