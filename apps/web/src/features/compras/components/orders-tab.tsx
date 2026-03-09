"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, X, ExternalLink, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PurchaseOrder, Vendor, PurchaseOrderStatus } from "../types";
import { PO_STATUS_LABELS, PO_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from "../types";
import { updatePOStatus } from "../actions/compras-actions";

type Props = { orders: PurchaseOrder[]; vendors: Vendor[] };

export function OrdersTab({ orders, vendors }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const vendorName = o.vendor?.name?.toLowerCase() || "";
        return o.po_number.toLowerCase().includes(q) || vendorName.includes(q);
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }, [orders]);

  const handleStatusUpdate = async (id: string, status: PurchaseOrderStatus) => {
    await updatePOStatus(id, status);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar OC o proveedor..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-orange-500/50"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["all", "draft", "pending_approval", "approved", "sent", "received", "invoiced", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all whitespace-nowrap",
                statusFilter === s
                  ? "bg-orange-500/15 text-orange-500"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
              )}
            >
              {s === "all" ? "Todas" : PO_STATUS_LABELS[s]}
              <span className="ml-1 text-[9px] opacity-60">{statusCounts[s] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]"># OC</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Proveedor</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Fecha</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Monto</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Estado</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Prioridad</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((order, i) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setSelectedOrder(order)}
                  className="cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-muted)]/50"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-orange-500">{order.po_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold text-white"
                        style={{ backgroundColor: PO_STATUS_COLORS[order.status] }}>
                        {order.vendor?.name?.charAt(0) || "?"}
                      </div>
                      <span className="text-[var(--text-primary)]">{order.vendor?.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                    ${Number(order.total).toLocaleString("en", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        color: PO_STATUS_COLORS[order.status],
                        backgroundColor: `${PO_STATUS_COLORS[order.status]}15`,
                      }}
                    >
                      {PO_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ color: PRIORITY_COLORS[order.priority], backgroundColor: `${PRIORITY_COLORS[order.priority]}12` }}
                    >
                      {PRIORITY_LABELS[order.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-[var(--text-muted)]" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 50 && (
          <div className="border-t border-[var(--border)] px-4 py-2 text-center text-[10px] text-[var(--text-muted)]">
            Mostrando 50 de {filtered.length} órdenes
          </div>
        )}
      </div>

      {/* Order Detail Sheet */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} onStatusUpdate={handleStatusUpdate} />
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderDetailSheet({ order, onClose, onStatusUpdate }: { order: PurchaseOrder; onClose: () => void; onStatusUpdate: (id: string, status: PurchaseOrderStatus) => void }) {
  const statusSteps: PurchaseOrderStatus[] = ["draft","pending_approval","approved","sent","received","invoiced","closed"];
  const currentIdx = statusSteps.indexOf(order.status);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="h-full w-full max-w-lg overflow-y-auto bg-[var(--bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4">
          <div>
            <p className="font-mono text-sm font-bold text-orange-500">{order.po_number}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{order.vendor?.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--bg-muted)]">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Progress bar */}
          <div>
            <p className="mb-2 text-[10px] font-semibold text-[var(--text-muted)]">PROGRESO</p>
            <div className="flex items-center gap-1">
              {statusSteps.map((step, i) => (
                <div key={step} className="flex items-center flex-1">
                  <div className={cn(
                    "h-2 w-full rounded-full transition-all",
                    i <= currentIdx ? "bg-orange-500" : "bg-[var(--bg-muted)]"
                  )} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[8px] text-[var(--text-muted)]">Borrador</span>
              <span className="text-[8px] text-[var(--text-muted)]">Cerrada</span>
            </div>
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-[9px] text-[var(--text-muted)]">Estado</p>
              <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: PO_STATUS_COLORS[order.status], backgroundColor: `${PO_STATUS_COLORS[order.status]}15` }}>
                {PO_STATUS_LABELS[order.status]}
              </span>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-[9px] text-[var(--text-muted)]">Prioridad</p>
              <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: PRIORITY_COLORS[order.priority], backgroundColor: `${PRIORITY_COLORS[order.priority]}12` }}>
                {PRIORITY_LABELS[order.priority]}
              </span>
            </div>
          </div>

          {/* Amounts */}
          <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Subtotal</span>
              <span className="text-[var(--text-primary)]">${Number(order.subtotal).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">IVA ({order.tax_rate}%)</span>
              <span className="text-[var(--text-primary)]">${Number(order.tax).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-[var(--border)] pt-2 flex justify-between text-sm font-bold">
              <span className="text-[var(--text-primary)]">Total</span>
              <span className="text-orange-500">${Number(order.total).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold text-[var(--text-muted)]">POSICIONES ({order.items.length})</p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-xs font-medium text-[var(--text-primary)]">{item.description}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{item.material_code} · {item.quantity} {item.unit}</p>
                      </div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">${Number(item.total_price).toLocaleString("en", { minimumFractionDigits: 2 })}</p>
                    </div>
                    {Number(item.received_quantity) > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
                          <span>Recibido: {item.received_quantity}/{item.quantity}</span>
                          <span>{((Number(item.received_quantity) / Number(item.quantity)) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(Number(item.received_quantity) / Number(item.quantity)) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {order.status === "pending_approval" && (
            <div className="flex gap-2">
              <button onClick={() => onStatusUpdate(order.id, "approved")} className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white hover:bg-emerald-600">Aprobar</button>
              <button onClick={() => onStatusUpdate(order.id, "cancelled")} className="flex-1 rounded-lg bg-red-500/10 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20">Rechazar</button>
            </div>
          )}
          {order.status === "approved" && (
            <button onClick={() => onStatusUpdate(order.id, "sent")} className="w-full rounded-lg bg-purple-500 py-2 text-xs font-semibold text-white hover:bg-purple-600">Marcar como Enviada</button>
          )}
          {order.status === "sent" && (
            <button onClick={() => onStatusUpdate(order.id, "received")} className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white hover:bg-emerald-600">Registrar Recepción</button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
