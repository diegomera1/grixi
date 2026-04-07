"use client";

import { useState } from "react";
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
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

// Dynamic import — new holographic single-warehouse 3D (no SSR)
const WarehouseSingle3D = dynamic(
  () => import("./warehouse-single-3d").then((mod) => mod.WarehouseSingle3D),
  { ssr: false, loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Cuboid size={48} className="mx-auto mb-3 animate-pulse text-brand" />
        <p className="text-sm text-text-muted">Cargando escena 3D...</p>
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
    image_url: string | null;
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
  initialView?: "2d" | "3d";
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

// ─── Shared Rack Detail Content ─────────────────────────

function RackDetailContent({ rack, onClose }: { rack: Rack; onClose: () => void }) {
  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-mono text-base font-bold text-text-primary">
              Rack {rack.code}
            </h3>
            <p className="text-xs text-text-muted">
              {rack.rows} filas × {rack.columns} columnas
              {rack.aisle && ` · Pasillo ${rack.aisle}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Position grid */}
      <div className="space-y-1 p-4">
        {Array.from({ length: rack.rows }, (_, rowIdx) => {
          const row = rowIdx + 1;
          return (
            <div key={row} className="flex items-center gap-1">
              <span className="w-4 text-center text-[9px] font-medium text-text-muted">
                {row}
              </span>
              <div className="flex flex-1 gap-1">
                {Array.from({ length: rack.columns }, (_, colIdx) => {
                  const col = colIdx + 1;
                  const pos = rack.rack_positions.find(
                    (p) => p.row_number === row && p.column_number === col
                  );
                  const status = pos ? getPositionStatus(pos) : "empty";
                  const cfg = statusConfig[status] || statusConfig.empty;
                  return (
                    <div
                      key={col}
                      className="flex-1 rounded-md p-1.5 transition-all"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <div
                        className="mx-auto h-3 w-3 rounded-sm"
                        style={{ backgroundColor: cfg.color }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Products */}
      <div className="border-t border-border p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Productos en este rack
        </h4>
        <div className="space-y-2">
          {rack.rack_positions
            .filter((p) => p.inventory)
            .slice(0, 8)
            .map((pos) => {
              const inv = pos.inventory!;
              const invStatus = statusConfig[inv.status] || statusConfig.active;
              return (
                <div key={pos.id} className="rounded-lg bg-muted/50 p-2.5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {inv.product_name}
                      </p>
                      <p className="font-mono text-[10px] text-brand">{inv.product_sku}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ backgroundColor: invStatus.bg, color: invStatus.color }}
                    >
                      {invStatus.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-muted">
                    <span>Pos: {pos.row_number}-{pos.column_number}</span>
                    <span>Cant: {inv.quantity}</span>
                    {inv.lot_number && <span>Lote: {inv.lot_number}</span>}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}

// ─── Component ──────────────────────────────────────────

export function WarehouseDetail({ warehouse, racks, stats, initialView = "2d" }: WarehouseDetailProps) {
  const [viewMode, setViewMode] = useState<"2d" | "3d">(initialView);
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [is3DFullscreen, setIs3DFullscreen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/almacenes"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Volver a Almacenes
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand shadow-md shadow-brand/20">
                <Box size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">{warehouse.name}</h2>
                <p className="text-[11px] text-text-secondary">
                  {warehouseTypeLabels[warehouse.type] || warehouse.type}
                  {warehouse.location && ` · ${warehouse.location}`}
                </p>
              </div>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex gap-0.5 rounded-xl border border-border bg-surface p-0.5">
            <button
              onClick={() => setViewMode("2d")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                viewMode === "2d"
                  ? "bg-muted text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <Grid3x3 size={14} />
              Plano 2D
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                viewMode === "3d"
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <Cuboid size={14} />
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
            className="rounded-lg border border-border bg-surface p-2.5"
          >
            <s.icon size={12} style={{ color: s.color }} />
            <p className="mt-1.5 text-base font-bold tabular-nums text-text-primary">{s.value}</p>
            <p className="text-[9px] text-text-muted">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main content area */}
      <div className="relative">
        {/* Visualization area */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <AnimatePresence mode="wait">
            {viewMode === "2d" ? (
              <motion.div
                key="2d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 md:p-6"
              >
                {/* Legend */}
                <div className="mb-4 md:mb-6 flex flex-wrap items-center gap-3 md:gap-4">
                  {Object.entries(statusConfig).slice(0, 6).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: cfg.color }} />
                      <span className="text-[11px] text-text-muted">{cfg.label}</span>
                    </div>
                  ))}
                </div>

                {/* Racks grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {racks.map((rack) => {
                    const occupied = rack.rack_positions.filter((p) => p.status === "occupied").length;
                    const total = rack.rows * rack.columns;
                    const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;
                    const productsInRack = rack.rack_positions
                      .filter((p) => p.inventory)
                      .map((p) => p.inventory!.product_name);
                    const uniqueProducts = [...new Set(productsInRack)];

                    return (
                      <motion.button
                        key={rack.id}
                        onClick={() => setSelectedRack(rack)}
                        className={cn(
                          "group relative rounded-xl border p-3 text-left transition-all",
                          selectedRack?.id === rack.id
                            ? "border-brand/30 bg-brand/5 shadow-md ring-1 ring-brand/10"
                            : "border-border bg-primary hover:border-brand/15 hover:shadow-sm"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-text-primary">
                            {rack.code}
                          </span>
                          {rack.aisle && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-text-muted">
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
                                className="aspect-square rounded-[3px]"
                                style={{ backgroundColor: cfg.color }}
                              />
                            );
                          })}
                        </div>

                        <p className="mt-2 text-[10px] text-text-muted">
                          {occupied}/{total} ocupadas · {occupancy}%
                        </p>

                        {/* Hover tooltip — desktop only */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-60 mb-2 hidden w-56 -translate-x-1/2 rounded-xl border border-border bg-elevated p-3 shadow-xl md:group-hover:block">
                          <p className="mb-1 font-mono text-xs font-bold text-text-primary">
                            {rack.code}
                          </p>
                          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-brand transition-all"
                              style={{ width: `${occupancy}%` }}
                            />
                          </div>
                          <div className="space-y-1 text-[10px] text-text-muted">
                            <p>{occupied} de {total} posiciones ocupadas ({occupancy}%)</p>
                            <p>{uniqueProducts.length} producto{uniqueProducts.length !== 1 ? "s" : ""} distinto{uniqueProducts.length !== 1 ? "s" : ""}</p>
                            {uniqueProducts.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {uniqueProducts.slice(0, 3).map((name) => (
                                  <p key={name} className="truncate text-text-secondary">• {name}</p>
                                ))}
                                {uniqueProducts.length > 3 && (
                                  <p className="text-text-muted">+{uniqueProducts.length - 3} más</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="3d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full h-[calc(100vh-200px)] min-h-[500px]"
              >
                {/* Fullscreen button */}
                <button
                  onClick={() => setIs3DFullscreen(true)}
                  className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:border-white/30"
                >
                  <Maximize2 size={12} />
                  Pantalla Completa
                </button>
                <WarehouseSingle3D
                  warehouse={warehouse}
                  racks={racks}
                  onRackSelect={(rack) => setSelectedRack(rack)}
                  selectedRackId={selectedRack?.id || null}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rack detail — overlay panel */}
        <AnimatePresence>
          {selectedRack && (
            <>
              {/* Mobile backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm md:hidden"
                onClick={() => setSelectedRack(null)}
              />
              {/* Mobile: bottom sheet */}
              <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-70 max-h-[85vh] overflow-hidden rounded-t-[26px] bg-surface shadow-[0_-10px_50px_rgba(0,0,0,0.25)] md:hidden"
                style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className="h-[4px] w-9 rounded-full bg-text-muted/30" />
                </div>
                <div className="overflow-y-auto max-h-[calc(85vh-40px)]">
                  <RackDetailContent rack={selectedRack} onClose={() => setSelectedRack(null)} />
                </div>
              </motion.div>
              {/* Desktop: right side panel overlay */}
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="hidden md:block absolute top-0 right-0 w-[340px] max-h-full z-20"
              >
                <div className="h-full overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl">
                  <RackDetailContent rack={selectedRack} onClose={() => setSelectedRack(null)} />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 3D Fullscreen Overlay */}
      <AnimatePresence>
        {is3DFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 bg-[#0a0e1a]"
          >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-linear-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand">
                  <Cuboid size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{warehouse.name}</p>
                  <p className="text-[10px] text-white/50">Vista 3D Holográfica</p>
                </div>
              </div>
              <button
                onClick={() => setIs3DFullscreen(false)}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <Minimize2 size={12} />
                Salir
              </button>
            </div>
            {/* 3D Scene */}
            <WarehouseSingle3D
              warehouse={warehouse}
              racks={racks}
              onRackSelect={(rack) => setSelectedRack(rack)}
              selectedRackId={selectedRack?.id || null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
