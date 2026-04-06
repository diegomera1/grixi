"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Clock, CheckCircle2, Truck, Package, AlertTriangle,
  Search, MapPin, Calendar, DollarSign, ArrowUpFromLine,
  XCircle, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesOrderRow } from "../types";
import { SalesOrderProfileDrawer } from "./sales-order-profile-drawer";

type SalesOrdersTabProps = {
  orders: SalesOrderRow[];
  onCreateIssue?: (soId: string, warehouseId: string, soNumber: string) => void;
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
  confirmed: { label: "Confirmado", color: "text-blue-500", bg: "bg-blue-500/10", icon: CheckCircle2 },
  picking: { label: "En Picking", color: "text-indigo-500", bg: "bg-indigo-500/10", icon: Package },
  partially_shipped: { label: "Parcial", color: "text-cyan-500", bg: "bg-cyan-500/10", icon: Truck },
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

type StatusFilter = "all" | "pending" | "confirmed" | "picking" | "shipped" | "delivered" | "cancelled";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function SalesOrdersTab({ orders, onCreateIssue }: SalesOrdersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [profileOrderId, setProfileOrderId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const filtered = orders.filter((o) => {
    const matchSearch = !searchQuery ||
      o.so_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter ||
      (statusFilter === "shipped" && (o.status === "shipped" || o.status === "partially_shipped"));
    return matchSearch && matchStatus;
  });

  // KPI summary
  const pendingCount = orders.filter(o => o.status === "pending" || o.status === "confirmed").length;
  const inPickingCount = orders.filter(o => o.status === "picking").length;
  const shippedCount = orders.filter(o => o.status === "shipped" || o.status === "delivered" || o.status === "partially_shipped").length;
  const totalValue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const urgentCount = orders.filter(o => o.priority === "urgent" && o.status !== "delivered" && o.status !== "cancelled" && o.status !== "shipped").length;

  const statusFilters: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: orders.length },
    { id: "pending", label: "Pendientes", count: orders.filter(o => o.status === "pending").length },
    { id: "confirmed", label: "Confirmados", count: orders.filter(o => o.status === "confirmed").length },
    { id: "picking", label: "En Picking", count: orders.filter(o => o.status === "picking").length },
    { id: "shipped", label: "Despachados", count: shippedCount },
    { id: "delivered", label: "Entregados", count: orders.filter(o => o.status === "delivered").length },
    { id: "cancelled", label: "Cancelados", count: orders.filter(o => o.status === "cancelled").length },
  ];

  function openProfile(orderId: string) {
    setProfileOrderId(orderId);
    setProfileOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* ── Quick KPIs ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Pendientes", value: pendingCount, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/8" },
          { label: "En Picking", value: inPickingCount, icon: Package, color: "text-indigo-500", bg: "bg-indigo-500/8" },
          { label: "Despachados", value: shippedCount, icon: Truck, color: "text-emerald-500", bg: "bg-emerald-500/8" },
          { label: "Urgentes", value: urgentCount, icon: AlertTriangle, color: urgentCount > 0 ? "text-red-500" : "text-slate-500", bg: urgentCount > 0 ? "bg-red-500/8" : "bg-slate-500/8" },
          { label: "Valor Total", value: formatCurrency(totalValue), icon: DollarSign, color: "text-violet-500", bg: "bg-violet-500/8" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
          >
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", kpi.bg)}>
              <kpi.icon size={14} className={kpi.color} />
            </div>
            <div>
              <p className="text-sm font-bold tabular-nums text-text-primary">{kpi.value}</p>
              <p className="text-[9px] font-medium text-text-muted">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Filters + Search ─────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {statusFilters.filter(f => f.count > 0 || f.id === "all").map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                statusFilter === f.id
                  ? "bg-brand text-white"
                  : "bg-muted text-text-muted hover:text-text-secondary"
              )}
            >
              {f.label}
              <span className={cn(
                "text-[10px] font-bold tabular-nums ml-0.5",
                statusFilter === f.id ? "text-white/70" : ""
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar pedido o cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* ── Orders List ────────────────── */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <ShoppingCart size={28} className="mb-2 opacity-30" />
            <p className="text-xs">
              {searchQuery ? "No se encontraron pedidos" : "No hay pedidos de venta"}
            </p>
          </div>
        ) : (
          filtered.map((order, i) => {
            const st = STATUS_CFG[order.status] || STATUS_CFG.pending;
            const StIcon = st.icon;
            const pri = PRIORITY_CFG[order.priority] || PRIORITY_CFG.medium;
            const days = daysUntil(order.requested_delivery_date);
            const isOverdue = days !== null && days < 0 && order.status !== "delivered" && order.status !== "shipped" && order.status !== "cancelled";
            const isCancelled = order.status === "cancelled";

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "rounded-xl border bg-surface overflow-hidden transition-all cursor-pointer group",
                  isCancelled
                    ? "border-red-500/10 opacity-60 hover:opacity-80"
                    : isOverdue
                    ? "border-red-500/20 hover:border-red-500/40"
                    : "border-border hover:border-brand/20 hover:shadow-sm"
                )}
                onClick={() => openProfile(order.id)}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Icon */}
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
                    isCancelled ? "bg-red-500/10" : "bg-indigo-500/10"
                  )}>
                    <ShoppingCart size={18} className={isCancelled ? "text-red-500" : "text-indigo-500"} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text-primary">{order.so_number}</span>
                      <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", st.bg)}>
                        <StIcon size={10} className={st.color} />
                        <span className={cn("text-[9px] font-bold", st.color)}>{st.label}</span>
                      </div>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", pri.bg, pri.color)}>
                        {pri.label}
                      </span>
                      {isOverdue && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 animate-pulse">
                          ⚠ Atrasado {Math.abs(days!)}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 truncate">{order.customer_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-text-muted">
                      {order.warehouse_name && (
                        <span className="flex items-center gap-0.5">
                          <MapPin size={8} /> {order.warehouse_name}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Calendar size={8} /> {formatDate(order.requested_delivery_date)}
                      </span>
                      {order.items_count !== undefined && order.items_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Package size={8} /> {order.items_count} mat.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Price + Action */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-text-primary">{formatCurrency(order.total)}</p>
                    {order.sap_so_number && (
                      <p className="text-[9px] font-mono text-violet-500 mt-0.5">SAP: {order.sap_so_number}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openProfile(order.id);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium text-text-muted hover:text-brand hover:bg-brand/5 transition-all"
                      >
                        <Eye size={10} /> Ver
                      </button>
                      {!isCancelled && (order.status === "pending" || order.status === "confirmed" || order.status === "picking") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onCreateIssue && order.warehouse_id) {
                              onCreateIssue(order.id, order.warehouse_id, order.so_number);
                            }
                          }}
                          disabled={!order.warehouse_id}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold text-brand bg-brand/5 hover:bg-brand/10 transition-all disabled:opacity-40"
                        >
                          <ArrowUpFromLine size={10} /> Salida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ── Profile Drawer ── */}
      <SalesOrderProfileDrawer
        orderId={profileOrderId}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onCreateIssue={onCreateIssue}
      />
    </motion.div>
  );
}
