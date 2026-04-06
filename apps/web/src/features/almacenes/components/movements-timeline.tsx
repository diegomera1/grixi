"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat2,
  Search,
  Clock,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { InventoryMovementRow } from "../types";

type MovementsTimelineProps = {
  movements: InventoryMovementRow[];
};

type MovementFilter = "all" | "inbound" | "outbound" | "transfer";

const MOVE_CFG: Record<string, { label: string; icon: typeof ArrowDownToLine; color: string; bg: string; sap: string }> = {
  inbound: { label: "Entrada", icon: ArrowDownToLine, color: "text-emerald-500", bg: "bg-emerald-500/10", sap: "101" },
  outbound: { label: "Salida", icon: ArrowUpFromLine, color: "text-rose-500", bg: "bg-rose-500/10", sap: "201" },
  transfer: { label: "Traspaso", icon: Repeat2, color: "text-blue-500", bg: "bg-blue-500/10", sap: "311" },
};

const SAP_TYPE_LABELS: Record<string, string> = {
  "101": "Entrada de mercancía",
  "102": "Anulación de entrada",
  "201": "Salida por centro de costo",
  "261": "Salida por pedido de venta",
  "262": "Anulación de salida",
  "301": "Traspaso entre almacenes",
  "311": "Traspaso interno",
  "551": "Salida por merma",
  "999": "Otro",
};

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" }) + " " +
    d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}

export function MovementsTimeline({ movements }: MovementsTimelineProps) {
  const [filter, setFilter] = useState<MovementFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const matchFilter = filter === "all" || m.movement_type === filter;
      const matchSearch = !searchQuery ||
        m.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.product_sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.sap_document_id && m.sap_document_id.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchFilter && matchSearch;
    });
  }, [movements, filter, searchQuery]);

  // Stats per type
  const stats = useMemo(() => ({
    inbound: movements.filter(m => m.movement_type === "inbound").length,
    outbound: movements.filter(m => m.movement_type === "outbound").length, 
    transfer: movements.filter(m => m.movement_type === "transfer").length,
    total: movements.length,
  }), [movements]);

  const filters: { id: MovementFilter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: stats.total },
    { id: "inbound", label: "Entradas", count: stats.inbound },
    { id: "outbound", label: "Salidas", count: stats.outbound },
    { id: "transfer", label: "Traspasos", count: stats.transfer },
  ];

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, InventoryMovementRow[]> = {};
    for (const m of filtered) {
      const dateKey = new Date(m.created_at).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(m);
    }
    return Object.entries(groups);
  }, [filtered]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* ── Filter bar ─────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                filter === f.id
                  ? "bg-brand text-white"
                  : "bg-muted text-text-muted hover:text-text-secondary"
              )}
            >
              {f.label}
              <span className={cn("text-[10px] font-bold tabular-nums", filter === f.id ? "text-white/70" : "")}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por producto, SKU o referencia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* ── Timeline ────────────────────── */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Clock size={28} className="mb-2 opacity-30" />
          <p className="text-xs">No hay movimientos registrados</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider whitespace-nowrap">
                  {dateLabel}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-mono text-text-muted">{items.length} mov</span>
              </div>

              {/* Timeline items */}
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-2">
                  {items.map((m, i) => {
                    const cfg = MOVE_CFG[m.movement_type] || MOVE_CFG.inbound;
                    const MIcon = cfg.icon;
                    const sapLabel = m.sap_movement_type ? SAP_TYPE_LABELS[m.sap_movement_type] || m.sap_movement_type : null;

                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="relative"
                      >
                        {/* Dot on timeline */}
                        <div
                          className={cn("absolute -left-[18px] top-4 w-2.5 h-2.5 rounded-full border-2 border-primary", cfg.bg)}
                          style={{ backgroundColor: cfg.color === "text-emerald-500" ? "#10B981" : cfg.color === "text-rose-500" ? "#F43F5E" : "#3B82F6" }}
                        />

                        <div className="rounded-xl border border-border bg-surface p-3.5 hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", cfg.bg)}>
                              <MIcon size={14} className={cfg.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-text-primary truncate">{m.product_name}</span>
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                                  {cfg.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                                <span className="font-mono">{m.product_sku}</span>
                                <span>·</span>
                                <span className="font-semibold">{m.quantity} UN</span>
                                <span>·</span>
                                <span>{m.warehouse_name}</span>
                                {m.lot_number && (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-0.5">
                                      <Hash size={8} /> {m.lot_number}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-text-muted">{formatRelativeTime(m.created_at)}</p>
                              <p className="text-[9px] font-mono text-text-muted">{formatDateTime(m.created_at)}</p>
                            </div>
                          </div>
                          {/* Movement description or SAP reference */}
                          {(m.movement_description || m.sap_movement_type || m.sap_document_id) && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                              {m.movement_description ? (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-text-secondary">
                                  {m.movement_description}
                                </span>
                              ) : m.sap_movement_type && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-text-secondary">
                                  {sapLabel || "Movimiento de material"}
                                </span>
                              )}
                              {m.sap_document_id && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  Ref: {m.sap_document_id}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
