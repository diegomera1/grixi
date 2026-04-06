"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowDownToLine, ArrowUpFromLine, Repeat2, Clock,
  Package, MapPin, Hash, Calendar, FileText, Box,
  ArrowRight, Warehouse, User, Loader2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MiniWarehouse3D = dynamic(() => import("./mini-warehouse-3d"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] flex items-center justify-center bg-[#0d0f1e] rounded-xl">
      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────
type MovementDetail = {
  id: string;
  movement_type: string;
  movement_description: string | null;
  quantity: number;
  created_at: string;
  sap_movement_type: string | null;
  sap_document_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  lot_number: string | null;
  performed_by_name: string | null;
  // Product
  product_name: string;
  product_sku: string;
  // Warehouse
  warehouse_name: string;
  warehouse_id: string | null;
  // From position
  from_rack_code: string | null;
  from_row: number | null;
  from_col: number | null;
  from_position_label: string | null;
  // To position
  to_rack_code: string | null;
  to_row: number | null;
  to_col: number | null;
  to_position_label: string | null;
  // Storage unit
  su_code: string | null;
  su_type: string | null;
  su_quantity: number | null;
};

const MOVE_TYPE_CFG: Record<string, { label: string; icon: typeof ArrowDownToLine; color: string; bg: string; border: string }> = {
  receipt: { label: "Entrada de Mercancía", icon: ArrowDownToLine, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  inbound: { label: "Entrada de Mercancía", icon: ArrowDownToLine, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  issue: { label: "Salida de Mercancía", icon: ArrowUpFromLine, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  outbound: { label: "Salida de Mercancía", icon: ArrowUpFromLine, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  transfer: { label: "Traspaso", icon: Repeat2, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
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
};

const REF_TYPE_LABELS: Record<string, string> = {
  goods_receipt: "Entrada de Mercancía",
  goods_issue: "Salida de Mercancía",
  transfer_order: "Orden de Traspaso",
};

// ── Props ──────────────────────────────────────────────
type MovementProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  movementId: string;
};

// ── Component ──────────────────────────────────────────
export function MovementProfileDrawer({ open, onClose, movementId }: MovementProfileDrawerProps) {
  const [detail, setDetail] = useState<MovementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !movementId) return;
    startTransition(() => {
      setLoading(true);
      setDetail(null);
    });

    fetch(`/api/wms/movement-detail?id=${movementId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setDetail(res.data);
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, movementId]);

  const typeCfg = detail
    ? MOVE_TYPE_CFG[detail.movement_type] || MOVE_TYPE_CFG.receipt
    : MOVE_TYPE_CFG.receipt;
  const TIcon = typeCfg.icon;

  // Build highlighted positions for 3D
  const highlighted3DPositions = detail
    ? [
        ...(detail.from_rack_code && detail.from_row && detail.from_col
          ? [{ rack_code: detail.from_rack_code, row_number: detail.from_row, column_number: detail.from_col, su_code: detail.su_code || "" }]
          : []),
        ...(detail.to_rack_code && detail.to_row && detail.to_col
          ? [{ rack_code: detail.to_rack_code, row_number: detail.to_row, column_number: detail.to_col, su_code: "" }]
          : []),
      ]
    : [];

  const formatFullDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-EC", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="mv-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            key="mv-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-y-auto bg-background border-l border-border shadow-2xl"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-brand" />
                  <span className="text-xs text-text-muted">Cargando detalle...</span>
                </div>
              </div>
            ) : !detail ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <AlertTriangle size={28} className="mb-2 opacity-30" />
                <p className="text-xs">No se pudo cargar el movimiento</p>
                <button onClick={onClose} className="mt-4 text-xs text-brand underline">Cerrar</button>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* ── Header ──────────────── */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", typeCfg.bg)}>
                      <TIcon size={22} className={typeCfg.color} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-text-primary">{typeCfg.label}</h2>
                      <p className="text-[10px] text-text-muted font-mono">
                        {detail.movement_description
                          || (detail.sap_movement_type ? SAP_TYPE_LABELS[detail.sap_movement_type] : null)
                          || typeCfg.label}
                      </p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <X size={16} className="text-text-muted" />
                  </button>
                </div>

                {/* ── Product Card ─────────── */}
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
                      <Package size={18} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{detail.product_name}</p>
                      <p className="text-[10px] font-mono text-text-muted">{detail.product_sku}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl font-bold tabular-nums", typeCfg.color)}>
                        {detail.movement_type === "issue" || detail.movement_type === "outbound" ? "-" : "+"}
                        {Math.abs(detail.quantity)}
                      </p>
                      <p className="text-[9px] text-text-muted">Unidades</p>
                    </div>
                  </div>

                  {/* Detail chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {detail.lot_number && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 text-[9px] font-medium">
                        <Hash size={8} /> {detail.lot_number}
                      </span>
                    )}
                    {detail.su_code && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 text-[9px] font-medium">
                        <Box size={8} /> {detail.su_code}
                        {detail.su_type && <span className="opacity-70 capitalize">({detail.su_type})</span>}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Info Grid ────────────── */}
                <div className="grid grid-cols-2 gap-2">
                  <InfoCard icon={Warehouse} label="Almacén" value={detail.warehouse_name} />
                  <InfoCard icon={Calendar} label="Fecha y Hora" value={formatFullDate(detail.created_at)} />
                  {detail.reference_type && (
                    <InfoCard
                      icon={FileText}
                      label="Operación Origen"
                      value={`${REF_TYPE_LABELS[detail.reference_type] || detail.reference_type}${detail.reference_number ? ` — ${detail.reference_number}` : ""}`}
                    />
                  )}
                  {detail.sap_document_id && (
                    <InfoCard icon={FileText} label="Doc. SAP" value={detail.sap_document_id} />
                  )}
                  {detail.performed_by_name && (
                    <InfoCard icon={User} label="Realizado por" value={detail.performed_by_name} />
                  )}
                </div>

                {/* ── Position Flow ─────────── */}
                {(detail.from_position_label || detail.to_position_label) && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <h3 className="text-[11px] font-bold text-text-primary mb-3 flex items-center gap-1.5">
                      <MapPin size={12} />
                      {detail.movement_type === "transfer" ? "Flujo de Posiciones" : "Ubicación"}
                    </h3>

                    <div className="flex items-center gap-3">
                      {detail.from_position_label && (
                        <div className={cn(
                          "flex-1 rounded-lg p-3 text-center",
                          detail.movement_type === "transfer" ? "bg-rose-500/8 border border-rose-500/15" : "bg-brand/8 border border-brand/15"
                        )}>
                          <p className="text-[9px] font-medium text-text-muted mb-1">
                            {detail.movement_type === "issue" || detail.movement_type === "outbound" ? "Origen" : detail.movement_type === "transfer" ? "Desde" : "Destino"}
                          </p>
                          <p className="text-sm font-mono font-bold text-text-primary">
                            {detail.from_rack_code}
                          </p>
                          <p className="text-[10px] font-mono text-text-muted">
                            F{detail.from_row} · C{detail.from_col}
                          </p>
                        </div>
                      )}

                      {detail.from_position_label && detail.to_position_label && (
                        <ArrowRight size={16} className="text-text-muted shrink-0" />
                      )}

                      {detail.to_position_label && (
                        <div className="flex-1 rounded-lg bg-emerald-500/8 border border-emerald-500/15 p-3 text-center">
                          <p className="text-[9px] font-medium text-text-muted mb-1">Destino</p>
                          <p className="text-sm font-mono font-bold text-text-primary">
                            {detail.to_rack_code}
                          </p>
                          <p className="text-[10px] font-mono text-text-muted">
                            F{detail.to_row} · C{detail.to_col}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Mini 3D ─────────────── */}
                {detail.warehouse_id && highlighted3DPositions.length > 0 && (() => {
                  const isOutbound = detail.movement_type === "issue" || detail.movement_type === "outbound";
                  const isTransfer = detail.movement_type === "transfer";
                  const shortDate = new Date(detail.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
                  const typeLabel = isOutbound ? "Salida" : isTransfer ? "Traspaso" : "Entrada";
                  const contextLabel = `${typeLabel} · ${shortDate}`;

                  return (
                    <div>
                      <h3 className="text-[11px] font-bold text-text-primary mb-1 flex items-center gap-1.5">
                        <MapPin size={12} />
                        {isOutbound
                          ? "Posición de Origen (donde estaba el material)"
                          : isTransfer
                            ? "Posiciones Involucradas"
                            : "Posición de Destino (donde se ubicó)"
                        }
                      </h3>
                      <p className="text-[9px] text-text-muted mb-2">
                        {isOutbound
                          ? `El material salió de esta posición el ${shortDate}. La posición actual puede estar vacía o con otro producto.`
                          : isTransfer
                            ? `El material se movió entre estas posiciones el ${shortDate}.`
                            : `El material fue ubicado en esta posición el ${shortDate}.`
                        }
                      </p>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <MiniWarehouse3D
                          warehouseId={detail.warehouse_id!}
                          warehouseName={detail.warehouse_name}
                          highlightedPositions={highlighted3DPositions}
                          contextLabel={contextLabel}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* ── Timestamp Footer ─────── */}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    <Clock size={10} />
                    <span>Registrado el {formatFullDate(detail.created_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Sub-Components ─────────────────────────────────────
function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2.5">
      <Icon size={12} className="text-text-muted shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[9px] text-text-muted">{label}</p>
        <p className="text-[10px] font-semibold text-text-primary leading-snug">{value}</p>
      </div>
    </div>
  );
}
