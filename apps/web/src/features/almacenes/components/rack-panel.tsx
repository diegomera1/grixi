"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Package, AlertTriangle, Clock, Box } from "lucide-react";

type Position = {
  id: string;
  row_number: number;
  column_number: number;
  status: string;
  inventory: {
    id: string;
    product_name: string;
    product_sku: string;
    category: string;
    image_url: string | null;
    quantity: number;
    lot_number: string | null;
    batch_code: string | null;
    entry_date: string | null;
    expiry_date: string | null;
    supplier: string | null;
    status: string;
  } | null;
};

type RackPanelProps = {
  rackCode: string;
  positions: Position[];
  rows: number;
  columns: number;
  occupancy: number;
  onClose: () => void;
  onPositionClick?: (pos: Position) => void;
};

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  occupied: { bg: "bg-emerald-500/15", text: "text-emerald-600", label: "Activo" },
  active: { bg: "bg-emerald-500/15", text: "text-emerald-600", label: "Activo" },
  empty: { bg: "bg-slate-200/50", text: "text-slate-400", label: "Vacío" },
  expired: { bg: "bg-red-500/15", text: "text-red-600", label: "Vencido" },
  quarantine: { bg: "bg-violet-500/15", text: "text-violet-600", label: "Cuarentena" },
  reserved: { bg: "bg-blue-500/15", text: "text-blue-600", label: "Reservado" },
};

export function RackPanel({ rackCode, positions, rows, columns, occupancy, onClose, onPositionClick }: RackPanelProps) {
  const occupied = positions.filter((p) => p.status !== "empty").length;
  const expired = positions.filter((p) => p.inventory?.status === "expired").length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-border bg-surface/98 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Rack {rackCode}</h3>
            <p className="text-[10px] text-text-muted">{rows}×{columns} posiciones</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-text-muted hover:text-text-primary">
            <X size={14} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-2.5">
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{Math.round(occupancy * 100)}%</p>
            <p className="text-[9px] text-text-muted">Ocupación</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-brand">{occupied}</p>
            <p className="text-[9px] text-text-muted">Ocupados</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-500">{expired}</p>
            <p className="text-[9px] text-text-muted">Vencidos</p>
          </div>
        </div>

        {/* Grid visualization */}
        <div className="border-b border-border px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold text-text-muted uppercase">Mapa de posiciones</p>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: columns }, (_, c) => {
                const pos = positions.find((p) => p.row_number === rows - r && p.column_number === c + 1);
                const st = pos?.inventory?.status || pos?.status || "empty";
                const styles = statusStyles[st] || statusStyles.empty;
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => pos && onPositionClick?.(pos)}
                    className={`aspect-square rounded-sm ${styles.bg} transition-all hover:ring-1 hover:ring-brand`}
                    title={pos?.inventory?.product_name || "Vacío"}
                  />
                );
              })
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(statusStyles).filter(([k]) => k !== "occupied").map(([key, s]) => (
              <div key={key} className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-sm ${s.bg}`} />
                <span className="text-[8px] text-text-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Position list */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="mb-2 text-[10px] font-semibold text-text-muted uppercase">Inventario</p>
          <div className="space-y-1.5">
            {positions
              .filter((p) => p.inventory)
              .sort((a, b) => a.row_number - b.row_number || a.column_number - b.column_number)
              .map((pos) => {
                const inv = pos.inventory!;
                const st = statusStyles[inv.status] || statusStyles.active;
                const daysIn = inv.entry_date
                  ? Math.floor((Date.now() - new Date(inv.entry_date).getTime()) / 86400000)
                  : null;

                return (
                  <button
                    key={pos.id}
                    onClick={() => onPositionClick?.(pos)}
                    className="flex w-full items-start gap-2 rounded-lg bg-muted/40 p-2 text-left transition-colors hover:bg-muted"
                  >
                    <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${st.bg}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-text-primary">{inv.product_name}</p>
                      <p className="text-[9px] text-text-muted">
                        {inv.product_sku} · F{pos.row_number}C{pos.column_number} · {inv.quantity} uds
                      </p>
                      {daysIn !== null && (
                        <p className="flex items-center gap-0.5 text-[8px] text-text-muted">
                          <Clock size={8} /> {daysIn}d en almacén
                          {inv.supplier && <> · {inv.supplier}</>}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
