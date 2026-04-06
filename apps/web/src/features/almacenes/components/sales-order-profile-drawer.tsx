"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ShoppingCart, Package, Truck, CheckCircle2, Clock,
  MapPin, Calendar, DollarSign, FileText, Loader2,
  User, Building2, ArrowUpFromLine, Eye, Sparkles, BarChart3,
  XCircle, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import dynamic from "next/dynamic";

const MiniWarehouse3D = dynamic(() => import("./mini-warehouse-3d"), {
  ssr: false,
});

// ── Types ──────────────────────────────────────────
type SOProfileProps = {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onCreateIssue?: (soId: string, warehouseId: string, soNumber: string) => void;
};

type SOProfileData = {
  id: string;
  so_number: string;
  customer_name: string;
  customer_code: string | null;
  status: string;
  priority: string;
  warehouse_id: string | null;
  warehouse_name: string | null;
  requested_delivery_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  shipping_address: string | null;
  sap_so_number: string | null;
  sap_delivery_number: string | null;
  notes: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  created_at: string;
  items: SOItemDetail[];
  goods_issues: LinkedGI[];
  su_positions: Record<string, SUPosition[]>;
  warehouse_positions: WarehousePositionGroup[];
  metrics: SOMetrics;
};

type SOItemDetail = {
  id: string;
  item_number: number;
  product_id: string;
  product_name: string;
  product_sku: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  quantity_picked: number;
  quantity_shipped: number;
};

type LinkedGI = {
  id: string;
  issue_number: string;
  status: string;
  posted_at: string | null;
  created_at: string;
  warehouse_name: string | null;
};

type SUPosition = {
  warehouse_id: string;
  warehouse_name: string;
  rack_code: string;
  row_number: number;
  column_number: number;
  su_code: string;
  quantity: number;
};

type WarehousePositionGroup = {
  warehouse_id: string;
  warehouse_name: string;
  positions: { rack_code: string; row_number: number; column_number: number; su_code: string; product_name: string }[];
};

type SOMetrics = {
  total_items: number;
  total_qty: number;
  total_picked: number;
  total_shipped: number;
  picking_progress: number;
  shipping_progress: number;
};

// ── Config ──────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
  confirmed: { label: "Confirmado", color: "text-blue-500", bg: "bg-blue-500/10", icon: CheckCircle2 },
  picking: { label: "En Picking", color: "text-indigo-500", bg: "bg-indigo-500/10", icon: Package },
  partially_shipped: { label: "Parcialmente Enviado", color: "text-cyan-500", bg: "bg-cyan-500/10", icon: Truck },
  shipped: { label: "Despachado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Truck },
  delivered: { label: "Entregado", color: "text-emerald-600", bg: "bg-emerald-600/10", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
};

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "Urgente", color: "text-red-500", bg: "bg-red-500/10" },
  high: { label: "Alta", color: "text-amber-500", bg: "bg-amber-500/10" },
  medium: { label: "Media", color: "text-blue-500", bg: "bg-blue-500/10" },
  low: { label: "Baja", color: "text-slate-500", bg: "bg-slate-500/10" },
};

const LIFECYCLE_STEPS = [
  { key: "created", label: "Creado", icon: FileText },
  { key: "confirmed", label: "Confirmado", icon: CheckCircle2 },
  { key: "picking", label: "Picking", icon: Package },
  { key: "shipped", label: "Despachado", icon: Truck },
  { key: "delivered", label: "Entregado", icon: CheckCircle2 },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getLifecycleIndex(status: string): number {
  const map: Record<string, number> = {
    pending: 0, confirmed: 1, picking: 2,
    partially_shipped: 3, shipped: 3, delivered: 4, cancelled: -1,
  };
  return map[status] ?? 0;
}

// ── Component ──────────────────────────────────────
export function SalesOrderProfileDrawer({ orderId, open, onClose, onCreateIssue }: SOProfileProps) {
  const [data, setData] = useState<SOProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "logistics" | "3d">("items");

  const loadProfile = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/wms/sales-order-profile?id=${id}`);
      const res = await resp.json();
      if (res.success) setData(res.data);
    } catch (err) {
      console.error("[SO Profile]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && orderId) {
      loadProfile(orderId);
      setActiveTab("items");
    }
  }, [open, orderId, loadProfile]);

  if (!open) return null;

  const st = STATUS_CFG[data?.status || "pending"] || STATUS_CFG.pending;
  const StIcon = st.icon;
  const pri = PRIORITY_CFG[data?.priority || "medium"] || PRIORITY_CFG.medium;
  const lifecycleIdx = getLifecycleIndex(data?.status || "pending");
  const isCancelled = data?.status === "cancelled";

  // Collect all SU positions for 3D
  const allPositions = data ? Object.values(data.su_positions).flat().map(p => ({
    rack_code: p.rack_code,
    row_number: p.row_number,
    column_number: p.column_number,
    su_code: p.su_code,
  })) : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[540px] overflow-y-auto border-l border-border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                    <ShoppingCart size={18} className="text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">{data?.so_number || "..."}</p>
                    <p className="text-[10px] text-text-muted">{data?.customer_name || "Cargando..."}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {data && (
                    <>
                      <div className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", st.bg)}>
                        <StIcon size={10} className={st.color} />
                        <span className={cn("text-[9px] font-bold", st.color)}>{st.label}</span>
                      </div>
                      <span className={cn("text-[9px] font-bold px-2 py-1 rounded-full", pri.bg, pri.color)}>
                        {pri.label}
                      </span>
                    </>
                  )}
                  <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin text-indigo-500" />
                <span className="ml-2 text-sm text-text-muted">Cargando perfil del pedido...</span>
              </div>
            ) : data ? (
              <div className="px-5 py-4 space-y-5">
                {/* ══ LIFECYCLE PROGRESS ══ */}
                {!isCancelled ? (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                      Ciclo de Vida del Pedido
                    </p>
                    <div className="flex items-center justify-between">
                      {LIFECYCLE_STEPS.map((step, i) => {
                        const isActive = i <= lifecycleIdx;
                        const isCurrent = i === lifecycleIdx;
                        const Icon = step.icon;
                        return (
                          <div key={step.key} className="flex flex-col items-center gap-1 relative flex-1">
                            {i > 0 && (
                              <div className={cn(
                                "absolute top-3 -left-1/2 w-full h-0.5",
                                isActive ? "bg-emerald-500" : "bg-border"
                              )} />
                            )}
                            <div className={cn(
                              "relative z-10 flex h-6 w-6 items-center justify-center rounded-full transition-all",
                              isCurrent
                                ? "bg-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/20"
                                : isActive
                                ? "bg-emerald-500/80"
                                : "bg-muted border border-border"
                            )}>
                              <Icon size={10} className={isActive ? "text-white" : "text-text-muted"} />
                            </div>
                            <span className={cn(
                              "text-[8px] font-medium",
                              isCurrent ? "text-emerald-500 font-bold" : isActive ? "text-text-secondary" : "text-text-muted"
                            )}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
                    <XCircle size={20} className="text-red-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-500">Pedido Cancelado</p>
                      <p className="text-[9px] text-text-muted">{data.notes}</p>
                    </div>
                  </div>
                )}

                {/* ══ PROGRESS BARS ══ */}
                {!isCancelled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-semibold text-text-muted">Picking</span>
                        <span className="text-xs font-bold text-indigo-500">{data.metrics.picking_progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${data.metrics.picking_progress}%` }}
                        />
                      </div>
                      <p className="text-[8px] text-text-muted mt-1">
                        {data.metrics.total_picked} / {data.metrics.total_qty} UN
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-semibold text-text-muted">Despacho</span>
                        <span className="text-xs font-bold text-emerald-500">{data.metrics.shipping_progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${data.metrics.shipping_progress}%` }}
                        />
                      </div>
                      <p className="text-[8px] text-text-muted mt-1">
                        {data.metrics.total_shipped} / {data.metrics.total_qty} UN
                      </p>
                    </div>
                  </div>
                )}

                {/* ══ KPI CARDS ══ */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Materiales", value: data.metrics.total_items, icon: Package, color: "text-blue-500", bg: "bg-blue-500/8" },
                    { label: "Unidades", value: data.metrics.total_qty, icon: BarChart3, color: "text-violet-500", bg: "bg-violet-500/8" },
                    { label: "Salidas", value: data.goods_issues.length, icon: ArrowUpFromLine, color: "text-orange-500", bg: "bg-orange-500/8" },
                    { label: "Total", value: formatCurrency(data.total), icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/8" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border border-border bg-surface p-2.5 text-center">
                      <kpi.icon size={12} className={cn(kpi.color, "mx-auto mb-1")} />
                      <p className="text-xs font-bold text-text-primary tabular-nums">{kpi.value}</p>
                      <p className="text-[8px] text-text-muted">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* ══ DETAIL INFO ══ */}
                <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div className="flex items-start gap-2">
                      <User size={11} className="text-text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[9px] text-text-muted">Cliente</p>
                        <p className="font-semibold text-text-primary">{data.customer_name}</p>
                        {data.customer_code && <p className="text-[9px] font-mono text-text-muted">{data.customer_code}</p>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Building2 size={11} className="text-text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[9px] text-text-muted">Almacén</p>
                        <p className="font-semibold text-text-primary">{data.warehouse_name || "Sin asignar"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar size={11} className="text-text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[9px] text-text-muted">Entrega Solicitada</p>
                        <p className="font-semibold text-text-primary">{formatDate(data.requested_delivery_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar size={11} className="text-text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[9px] text-text-muted">Creado</p>
                        <p className="font-semibold text-text-primary">{formatDateTime(data.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  {data.shipping_address && (
                    <div className="flex items-start gap-2 border-t border-border pt-2">
                      <MapPin size={11} className="text-text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[9px] text-text-muted">Dirección de Entrega</p>
                        <p className="text-[10px] font-medium text-text-primary">{data.shipping_address}</p>
                      </div>
                    </div>
                  )}
                  {data.sap_so_number && (
                    <div className="flex items-center gap-2 border-t border-border pt-2">
                      <span className="text-[9px] font-mono px-2 py-1 rounded-lg bg-violet-500/10 text-violet-500">
                        SAP: {data.sap_so_number}
                      </span>
                      {data.sap_delivery_number && (
                        <span className="text-[9px] font-mono px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-500">
                          Entrega: {data.sap_delivery_number}
                        </span>
                      )}
                    </div>
                  )}
                  {data.notes && !isCancelled && (
                    <div className="border-t border-border pt-2">
                      <p className="text-[9px] text-text-muted mb-0.5">Notas</p>
                      <p className="text-[10px] text-text-secondary leading-relaxed">{data.notes}</p>
                    </div>
                  )}
                </div>

                {/* ══ TABS ══ */}
                <div className="flex gap-1 rounded-xl bg-muted p-1">
                  {([
                    { id: "items" as const, label: "Materiales", icon: Package },
                    { id: "logistics" as const, label: "Logística", icon: Truck },
                    { id: "3d" as const, label: "Vista 3D", icon: Eye },
                  ]).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-medium transition-all",
                        activeTab === tab.id
                          ? "bg-background text-text-primary shadow-sm"
                          : "text-text-muted hover:text-text-secondary"
                      )}
                    >
                      <tab.icon size={11} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ══ TAB CONTENT ══ */}
                <AnimatePresence mode="wait">
                  {/* Items Tab */}
                  {activeTab === "items" && (
                    <motion.div
                      key="items"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      {data.items.map((item) => {
                        const pickPct = item.quantity > 0 ? Math.round((item.quantity_picked / item.quantity) * 100) : 0;
                        const shipPct = item.quantity > 0 ? Math.round((item.quantity_shipped / item.quantity) * 100) : 0;
                        const hasPositions = (data.su_positions[item.product_id] || []).length > 0;

                        return (
                          <div key={item.id} className="rounded-xl border border-border bg-surface p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-bold text-text-muted tabular-nums">
                                    #{item.item_number}
                                  </span>
                                  <span className="text-xs font-bold text-text-primary">{item.product_name}</span>
                                </div>
                                <p className="text-[9px] font-mono text-text-muted mt-0.5">{item.product_sku}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-text-primary tabular-nums">{formatCurrency(item.total_price)}</p>
                                <p className="text-[9px] text-text-muted">
                                  {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                                </p>
                              </div>
                            </div>

                            {/* Progress bars */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex justify-between text-[8px] text-text-muted mb-0.5">
                                  <span>Picking</span>
                                  <span className={cn("font-bold", pickPct === 100 ? "text-emerald-500" : pickPct > 0 ? "text-indigo-500" : "text-text-muted")}>
                                    {item.quantity_picked}/{item.quantity}
                                  </span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                                  <div className={cn("h-full rounded-full", pickPct === 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${pickPct}%` }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-[8px] text-text-muted mb-0.5">
                                  <span>Enviado</span>
                                  <span className={cn("font-bold", shipPct === 100 ? "text-emerald-500" : shipPct > 0 ? "text-cyan-500" : "text-text-muted")}>
                                    {item.quantity_shipped}/{item.quantity}
                                  </span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                                  <div className={cn("h-full rounded-full", shipPct === 100 ? "bg-emerald-500" : "bg-cyan-500")} style={{ width: `${shipPct}%` }} />
                                </div>
                              </div>
                            </div>

                            {/* Stock locations */}
                            {hasPositions && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <MapPin size={8} className="text-violet-500" />
                                {data.su_positions[item.product_id].slice(0, 3).map((p, i) => (
                                  <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 font-mono">
                                    {p.rack_code} R{p.row_number}C{p.column_number}
                                  </span>
                                ))}
                                {data.su_positions[item.product_id].length > 3 && (
                                  <span className="text-[8px] text-text-muted">
                                    +{data.su_positions[item.product_id].length - 3} más
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Totals */}
                      <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-text-muted">Subtotal</span>
                          <span className="text-text-primary tabular-nums">{formatCurrency(data.subtotal || 0)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-text-muted">IVA</span>
                          <span className="text-text-primary tabular-nums">{formatCurrency(data.tax || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t border-orange-500/20 mt-1 pt-1">
                          <span className="text-text-primary">Total</span>
                          <span className="text-orange-500 tabular-nums">{formatCurrency(data.total)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Logistics Tab */}
                  {activeTab === "logistics" && (
                    <motion.div
                      key="logistics"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {/* Timeline */}
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                          Línea de Tiempo
                        </p>
                        <div className="space-y-3">
                          <TimelineEvent
                            icon={FileText}
                            label="Pedido Creado"
                            date={formatDateTime(data.created_at)}
                            color="text-blue-500"
                            active
                          />
                          {data.confirmed_at && (
                            <TimelineEvent
                              icon={CheckCircle2}
                              label="Pedido Confirmado"
                              date={formatDateTime(data.confirmed_at)}
                              color="text-emerald-500"
                              active
                            />
                          )}
                          {(data.status === "picking" || lifecycleIdx >= 2) && (
                            <TimelineEvent
                              icon={Package}
                              label="En Proceso de Picking"
                              date={data.goods_issues.length > 0 ? formatDateTime(data.goods_issues[0].created_at) : "En curso"}
                              color="text-indigo-500"
                              active={lifecycleIdx >= 2}
                              current={data.status === "picking"}
                            />
                          )}
                          {data.shipped_at && (
                            <TimelineEvent
                              icon={Truck}
                              label={data.status === "partially_shipped" ? "Envío Parcial" : "Despachado"}
                              date={formatDateTime(data.shipped_at)}
                              color="text-cyan-500"
                              active
                            />
                          )}
                          {data.status === "delivered" && (
                            <TimelineEvent
                              icon={CheckCircle2}
                              label="Entregado al Cliente"
                              date={formatDateTime(data.shipped_at)}
                              color="text-emerald-600"
                              active
                            />
                          )}
                          {isCancelled && (
                            <TimelineEvent
                              icon={XCircle}
                              label="Cancelado"
                              date="—"
                              color="text-red-500"
                              active
                            />
                          )}
                        </div>
                      </div>

                      {/* Linked Goods Issues */}
                      <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                        <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">
                          Salidas de Mercancía Vinculadas ({data.goods_issues.length})
                        </p>
                        {data.goods_issues.length > 0 ? (
                          data.goods_issues.map((gi) => {
                            const giSt = gi.status === "posted"
                              ? { label: "Contabilizada", color: "text-emerald-500", bg: "bg-emerald-500/10" }
                              : gi.status === "draft"
                              ? { label: "Borrador", color: "text-amber-500", bg: "bg-amber-500/10" }
                              : { label: gi.status, color: "text-text-muted", bg: "bg-muted" };
                            return (
                              <div key={gi.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                                <div className="flex items-center gap-2">
                                  <ArrowUpFromLine size={12} className="text-orange-500" />
                                  <div>
                                    <p className="text-xs font-bold text-text-primary">{gi.issue_number}</p>
                                    <p className="text-[9px] text-text-muted">{gi.warehouse_name} · {formatDate(gi.posted_at || gi.created_at)}</p>
                                  </div>
                                </div>
                                <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", giSt.bg)}>
                                  <span className={cn("text-[9px] font-bold", giSt.color)}>{giSt.label}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex items-center gap-2 py-4 justify-center text-text-muted">
                            <AlertCircle size={12} />
                            <span className="text-[10px]">Sin salidas de mercancía creadas</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* 3D Tab — Multi-warehouse visualization */}
                  {activeTab === "3d" && (
                    <motion.div
                      key="3d"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {(data.warehouse_positions || []).length > 0 ? (
                        <>
                          <div className="flex items-center gap-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10 px-3 py-2">
                            <Sparkles size={12} className="text-indigo-500 shrink-0" />
                            <p className="text-[9px] text-indigo-500">
                              <span className="font-bold">{allPositions.length} ubicaciones</span> en {data.warehouse_positions.length} almacén{data.warehouse_positions.length > 1 ? "es" : ""}
                            </p>
                          </div>

                          {data.warehouse_positions.map((whGroup) => (
                            <div key={whGroup.warehouse_id} className="rounded-xl border border-indigo-500/20 overflow-hidden">
                              <div className="px-3 py-2 bg-indigo-500/5 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                  <Building2 size={10} />
                                  {whGroup.warehouse_name}
                                </p>
                                <span className="text-[8px] text-indigo-400 font-medium">
                                  {whGroup.positions.length} posicion{whGroup.positions.length > 1 ? "es" : ""}
                                </span>
                              </div>
                              <MiniWarehouse3D
                                warehouseId={whGroup.warehouse_id}
                                warehouseName={whGroup.warehouse_name}
                                highlightedPositions={whGroup.positions.map(p => ({
                                  rack_code: p.rack_code,
                                  row_number: p.row_number,
                                  column_number: p.column_number,
                                  su_code: p.su_code,
                                }))}
                                contextLabel={`Pedido ${data.so_number}`}
                              />
                              {/* Position list under 3D */}
                              <div className="px-3 py-2 bg-[#0d0f1e] space-y-1">
                                {whGroup.positions.map((p, i) => (
                                  <div key={i} className="flex items-center justify-between text-[8px]">
                                    <div className="flex items-center gap-1.5">
                                      <MapPin size={7} className="text-indigo-400" />
                                      <span className="font-mono text-indigo-300">{p.su_code}</span>
                                      <span className="text-zinc-400">{p.rack_code} R{p.row_number}C{p.column_number}</span>
                                    </div>
                                    <span className="text-zinc-500 text-[7px] truncate max-w-[120px]">{p.product_name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                          <Eye size={24} className="opacity-30 mb-2" />
                          <p className="text-xs">No hay material disponible en los almacenes</p>
                          <p className="text-[9px] text-text-muted mt-1">Los materiales de este pedido no tienen stock asignado</p>
                        </div>
                      )}

                      {/* Detailed SU legend per product */}
                      {Object.entries(data.su_positions).length > 0 && (
                        <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                          <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Stock Disponible por Material</p>
                          {data.items.map((item) => {
                            const positions = data.su_positions[item.product_id] || [];
                            if (positions.length === 0) return (
                              <div key={item.product_id} className="flex items-center justify-between text-[9px] px-2 py-1.5 rounded bg-red-500/5 border border-red-500/10">
                                <span className="text-text-primary font-medium">{item.product_name}</span>
                                <span className="text-red-500 font-bold">Sin stock</span>
                              </div>
                            );
                            const totalAvail = positions.reduce((s, p) => s + p.quantity, 0);
                            return (
                              <div key={item.product_id} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-bold text-text-primary">{item.product_name}</p>
                                  <span className="text-[9px] font-bold text-emerald-500 tabular-nums">{totalAvail} UN disp.</span>
                                </div>
                                <div className="grid gap-0.5">
                                  {positions.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between text-[8px] px-2 py-1 rounded bg-muted">
                                      <div className="flex items-center gap-1.5">
                                        <MapPin size={7} className="text-indigo-500" />
                                        <span className="font-mono text-text-primary">{p.su_code}</span>
                                        <span className="text-text-muted">{p.warehouse_name}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-text-muted">{p.rack_code} R{p.row_number}C{p.column_number}</span>
                                        <span className="font-bold text-emerald-500 tabular-nums">{p.quantity}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ══ ACTION BUTTONS ══ */}
                {!isCancelled && (data.status === "pending" || data.status === "confirmed" || data.status === "picking") && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <button
                      onClick={() => {
                        if (onCreateIssue && data.warehouse_id) {
                          onCreateIssue(data.id, data.warehouse_id, data.so_number);
                          onClose();
                        }
                      }}
                      disabled={!data.warehouse_id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-xs font-bold text-white hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      <ArrowUpFromLine size={14} />
                      Crear Salida de Mercancía
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Timeline Event Component ──────────────────────
function TimelineEvent({ icon: Icon, label, date, color, active, current }: {
  icon: typeof Clock;
  label: string;
  date: string;
  color: string;
  active: boolean;
  current?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full shrink-0",
        active ? `${color.replace("text-", "bg-")}/10` : "bg-muted",
        current && "ring-2 ring-offset-1 ring-offset-background ring-indigo-500/30"
      )}>
        <Icon size={10} className={active ? color : "text-text-muted"} />
      </div>
      <div className="flex-1 pb-3 border-b border-border/50 last:border-0">
        <p className={cn("text-[10px] font-semibold", active ? "text-text-primary" : "text-text-muted")}>
          {label}
        </p>
        <p className="text-[9px] text-text-muted">{date}</p>
      </div>
    </div>
  );
}
