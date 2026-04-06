"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowDownToLine, ArrowUpFromLine, Repeat2, Clock,
  CheckCircle2, AlertTriangle, Package, Truck, Loader2,
  MapPin, Hash, Calendar, FileText, Box, Eye, Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OperationProfile, OperationProfileItem } from "../types";
import { MOVEMENT_DESCRIPTIONS, SU_TYPE_LABELS } from "../types";
import type { StorageUnitType } from "../types";

const MiniWarehouse3D = dynamic(() => import("./mini-warehouse-3d"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] bg-[#0d0f1e] rounded-xl flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
    </div>
  ),
});

// ── Status configs ─────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
  inspecting: { label: "En Inspección", color: "text-violet-500", bg: "bg-violet-500/10", icon: Package },
  accepted: { label: "Contabilizado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  partial: { label: "Parcial", color: "text-orange-500", bg: "bg-orange-500/10", icon: Clock },
  picking: { label: "En Picking", color: "text-indigo-500", bg: "bg-indigo-500/10", icon: Package },
  confirmed: { label: "Confirmado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  in_transit: { label: "En Tránsito", color: "text-blue-500", bg: "bg-blue-500/10", icon: Truck },
  posted: { label: "Contabilizado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  completed: { label: "Completado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle },
  rejected: { label: "Rechazado", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle },
  reversed: { label: "Reversado", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle },
};

const TYPE_CFG = {
  gr: { label: "Entrada de Mercancía", icon: ArrowDownToLine, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  gi: { label: "Salida de Mercancía", icon: ArrowUpFromLine, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  to: { label: "Traspaso", icon: Repeat2, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
};

// ── Props ──────────────────────────────────────────────
type OperationProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  operationType: "gr" | "gi" | "to";
  operationId: string;
  onAction?: (action: string, id: string) => void;
};

// ── Drawer Component ───────────────────────────────────
export function OperationProfileDrawer({
  open, onClose, operationType, operationId, onAction,
}: OperationProfileDrawerProps) {
  const [profile, setProfile] = useState<OperationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [focusedRack, setFocusedRack] = useState<string | null>(null);
  const mini3DRef = useRef<HTMLDivElement>(null);

  // Build highlighted positions from items with rack data
  const positionedItems = useMemo(() => {
    if (!profile) return [];
    return profile.items
      .filter(i => i.rack_code && i.position_label)
      .map(i => {
        const parts = i.position_label!.split("-");
        return {
          rack_code: i.rack_code!,
          row_number: parseInt(parts[parts.length - 2]) || 0,
          column_number: parseInt(parts[parts.length - 1]) || 0,
          su_code: i.su_code || "",
          product_name: i.product_name,
          position_label: i.position_label!,
        };
      });
  }, [profile]);

  const handleItemClick = useCallback((rackCode: string) => {
    setFocusedRack(rackCode);
    setShow3D(true);
    setTimeout(() => {
      mini3DRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  useEffect(() => {
    if (!open || !operationId) return;
    setLoading(true);

    fetch(`/api/wms/operation-detail?type=${operationType}&id=${operationId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setProfile(res.data);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [open, operationType, operationId]);

  const typeCfg = TYPE_CFG[operationType];
  const TIcon = typeCfg.icon;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            key="profile-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-y-auto bg-background border-l border-border shadow-2xl"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-brand" />
              </div>
            ) : !profile ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <AlertTriangle size={28} className="mb-2 opacity-30" />
                <p className="text-xs">No se pudo cargar el detalle</p>
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
                      <h2 className="text-base font-bold text-text-primary">{profile.doc_number}</h2>
                      <p className="text-[10px] text-text-muted">{profile.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const st = STATUS_CFG[profile.status] || STATUS_CFG.pending;
                      const StIcon = st.icon;
                      return (
                        <div className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", st.bg)}>
                          <StIcon size={11} className={st.color} />
                          <span className={cn("text-[10px] font-bold", st.color)}>{st.label}</span>
                        </div>
                      );
                    })()}
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <X size={16} className="text-text-muted" />
                    </button>
                  </div>
                </div>

                {/* ── Operation Info Cards ─── */}
                <div className="grid grid-cols-2 gap-2">
                  <InfoCard icon={MapPin} label="Almacén" value={profile.warehouse_name} />
                  {profile.reference_doc && (
                    <InfoCard icon={FileText} label={operationType === "gr" ? "Orden de Compra" : "Pedido de Venta"} value={profile.reference_doc} />
                  )}
                  {profile.counterpart && (
                    <InfoCard icon={Package} label={operationType === "gr" ? "Proveedor" : "Cliente"} value={profile.counterpart} />
                  )}
                  <InfoCard icon={Calendar} label="Fecha" value={new Date(profile.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
                  {profile.from_warehouse_name && profile.to_warehouse_name && (
                    <>
                      <InfoCard icon={ArrowUpFromLine} label="Origen" value={profile.from_warehouse_name} />
                      <InfoCard icon={ArrowDownToLine} label="Destino" value={profile.to_warehouse_name} />
                    </>
                  )}
                  {profile.delivery_note && (
                    <InfoCard icon={FileText} label="Nota de Entrega" value={profile.delivery_note} />
                  )}
                  {profile.carrier && (
                    <InfoCard icon={Truck} label="Transportista" value={profile.carrier} />
                  )}
                </div>

                {/* ── KPIs ─────────────────── */}
                <div className="grid grid-cols-3 gap-2">
                  <KpiCard
                    label="Items"
                    value={profile.items.length}
                    color="text-brand"
                    bg="bg-brand/8"
                  />
                  <KpiCard
                    label="Total Unidades"
                    value={profile.items.reduce((s, i) => s + i.quantity, 0)}
                    color={typeCfg.color}
                    bg={typeCfg.bg}
                  />
                  <KpiCard
                    label="UAs"
                    value={profile.items.filter(i => i.su_code).length}
                    color="text-violet-500"
                    bg="bg-violet-500/8"
                  />
                </div>

                {/* ── Items Table ──────────── */}
                <div>
                  <h3 className="text-[11px] font-bold text-text-primary mb-2 flex items-center gap-1.5">
                    <Package size={12} />
                    Detalle de Materiales
                  </h3>
                  <div className="space-y-1.5">
                    {profile.items.map((item, i) => (
                      <ItemRow key={i} item={item} type={operationType} />
                    ))}
                  </div>
                </div>

                {/* ── Posiciones Involucradas ─────────────── */}
                {positionedItems.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold text-text-primary mb-2 flex items-center gap-1.5">
                      <Warehouse size={12} />
                      Ubicación en Almacén
                    </h3>

                    {/* Position cards — clickable to show 3D */}
                    <div className="space-y-1.5 mb-3">
                      {positionedItems.map((pos, i) => {
                        const isActive = focusedRack === pos.rack_code && show3D;
                        return (
                          <button
                            key={`${pos.rack_code}-${pos.row_number}-${pos.column_number}-${i}`}
                            onClick={() => handleItemClick(pos.rack_code)}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all group/pos",
                              isActive
                                ? "border-indigo-500/40 bg-indigo-500/5 shadow-sm shadow-indigo-500/10"
                                : "border-border bg-surface hover:border-indigo-500/30 hover:bg-indigo-500/[0.02]"
                            )}
                          >
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors",
                              isActive ? "bg-indigo-500/15" : "bg-muted group-hover/pos:bg-indigo-500/10"
                            )}>
                              <MapPin size={14} className={cn(
                                "transition-colors",
                                isActive ? "text-indigo-400" : "text-text-muted group-hover/pos:text-indigo-400"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-bold text-text-primary">
                                  {pos.rack_code}
                                </span>
                                <span className="text-[9px] text-text-muted">·</span>
                                <span className="text-[10px] font-mono text-indigo-400">
                                  F{pos.row_number}C{pos.column_number}
                                </span>
                              </div>
                              <p className="text-[9px] text-text-muted truncate mt-0.5">
                                {pos.product_name}
                                {pos.su_code && <span className="ml-1 text-cyan-500">{pos.su_code}</span>}
                              </p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                              <Eye size={11} className={cn(
                                "transition-colors",
                                isActive ? "text-indigo-400" : "text-transparent group-hover/pos:text-indigo-400/50"
                              )} />
                              <span className="text-[8px] text-transparent group-hover/pos:text-indigo-400/60 transition-colors">
                                Ver 3D
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* 3D Viewer — shown when clicked */}
                    {show3D && profile.warehouse_id && (
                      <div ref={mini3DRef} className="rounded-xl overflow-hidden">
                        <MiniWarehouse3D
                          warehouseId={profile.warehouse_id}
                          warehouseName={profile.warehouse_name}
                          focusedRackCode={focusedRack}
                          highlightedPositions={positionedItems.map(p => ({
                            rack_code: p.rack_code,
                            row_number: p.row_number,
                            column_number: p.column_number,
                            su_code: p.su_code,
                          }))}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ── Status Timeline ────────── */}
                {profile.movements.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold text-text-primary mb-3 flex items-center gap-1.5">
                      <Clock size={12} />
                      Línea de Tiempo ({profile.movements.length})
                    </h3>
                    <div className="relative pl-6">
                      {/* Vertical connector line */}
                      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

                      {profile.movements.map((m, idx) => {
                        const isLast = idx === profile.movements.length - 1;
                        const dotColor =
                          m.movement_type === "receipt" ? "bg-emerald-500" :
                          m.movement_type === "issue" ? "bg-rose-500" : "bg-blue-500";
                        const textColor =
                          m.movement_type === "receipt" ? "text-emerald-500" :
                          m.movement_type === "issue" ? "text-rose-500" : "text-blue-500";
                        const bgColor =
                          m.movement_type === "receipt" ? "bg-emerald-500/10" :
                          m.movement_type === "issue" ? "bg-rose-500/10" : "bg-blue-500/10";

                        return (
                          <div key={m.id} className="relative pb-4 last:pb-0">
                            {/* Dot on the timeline */}
                            <div className={cn(
                              "absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 border-background flex items-center justify-center z-10",
                              isLast ? dotColor : "bg-muted"
                            )}>
                              {isLast && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              )}
                            </div>

                            {/* Content */}
                            <div className={cn(
                              "rounded-lg border px-3 py-2.5 transition-all",
                              isLast ? `border-l-2 ${bgColor} border-${m.movement_type === "receipt" ? "emerald" : m.movement_type === "issue" ? "rose" : "blue"}-500/30` :
                              "border-border bg-surface"
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {m.movement_type === "receipt" ? <ArrowDownToLine size={11} className={textColor} /> :
                                   m.movement_type === "issue" ? <ArrowUpFromLine size={11} className={textColor} /> :
                                   <Repeat2 size={11} className={textColor} />}
                                  <span className={cn("text-[10px] font-bold", isLast ? textColor : "text-text-primary")}>
                                    {m.movement_description || MOVEMENT_DESCRIPTIONS[m.movement_type] || m.movement_type}
                                  </span>
                                </div>
                                <span className="text-[9px] text-text-muted font-mono">
                                  {new Date(m.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}{" "}
                                  {new Date(m.created_at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[9px] text-text-muted">
                                <span className="font-semibold tabular-nums">{Math.abs(m.quantity)} UN</span>
                                {m.lot_number && <span>· Lote: <span className="font-mono text-violet-400">{m.lot_number}</span></span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Actions ─────────────── */}
                <ActionBar profile={profile} onAction={onAction} />
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
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2.5">
      <Icon size={12} className="text-text-muted shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] text-text-muted">{label}</p>
        <p className="text-[10px] font-semibold text-text-primary truncate">{value}</p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-surface p-3">
      <span className={cn("text-lg font-bold tabular-nums", color)}>{value}</span>
      <span className="text-[9px] text-text-muted">{label}</span>
    </div>
  );
}

function ItemRow({ item, type }: { item: OperationProfileItem; type: "gr" | "gi" | "to" }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
        <Box size={14} className="text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-text-primary truncate">{item.product_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-text-muted flex-wrap">
          <span className="font-mono">{item.product_sku}</span>
          {item.lot_number && (
            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-violet-500/10 text-violet-500 font-medium">
              <Hash size={7} /> {item.lot_number}
            </span>
          )}
          {item.su_code && (
            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-500 font-medium">
              <Box size={7} /> {item.su_code}
              {item.su_type && <span className="opacity-70">({SU_TYPE_LABELS[item.su_type as StorageUnitType] || item.su_type})</span>}
            </span>
          )}
          {item.position_label && (
            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">
              <MapPin size={7} /> {item.position_label}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums text-text-primary">{item.quantity}</p>
        <p className="text-[9px] text-text-muted">UN</p>
      </div>
    </div>
  );
}

function ActionBar({ profile, onAction }: { profile: OperationProfile; onAction?: (action: string, id: string) => void }) {
  if (!onAction) return null;

  const actions: { label: string; action: string; color: string; bg: string; icon: typeof CheckCircle2 }[] = [];

  if (profile.type === "gr" && (profile.status === "pending" || profile.status === "receiving")) {
    actions.push({
      label: "Contabilizar Entrada",
      action: "post_goods_receipt",
      color: "text-white",
      bg: "bg-emerald-500 hover:bg-emerald-600",
      icon: CheckCircle2,
    });
  }

  if (profile.type === "gi" && profile.status === "picking") {
    actions.push({
      label: "Contabilizar Salida",
      action: "post_goods_issue",
      color: "text-white",
      bg: "bg-rose-500 hover:bg-rose-600",
      icon: CheckCircle2,
    });
  }

  if (profile.type === "to") {
    if (profile.status === "pending") {
      actions.push({
        label: "Confirmar Envío",
        action: "start_transfer",
        color: "text-white",
        bg: "bg-blue-500 hover:bg-blue-600",
        icon: Truck,
      });
    }
    if (profile.status === "in_transit") {
      actions.push({
        label: "Confirmar Recepción",
        action: "confirm_transfer",
        color: "text-white",
        bg: "bg-emerald-500 hover:bg-emerald-600",
        icon: CheckCircle2,
      });
    }
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2 pt-3 border-t border-border">
      {actions.map((a) => (
        <button
          key={a.action}
          onClick={() => onAction(a.action, profile.id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold transition-all",
            a.bg, a.color
          )}
        >
          <a.icon size={13} />
          {a.label}
        </button>
      ))}
    </div>
  );
}
