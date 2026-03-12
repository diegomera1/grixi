"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Clock, Truck, PackageCheck, DollarSign,
  TrendingUp, ArrowRight,
} from "lucide-react";
import type { PurchaseOrder, Vendor, ComprasKPIs, PurchaseOrderStatus } from "../types";
import { PO_STATUS_LABELS, PO_STATUS_COLORS, VENDOR_CATEGORY_LABELS } from "../types";

type Props = { orders: PurchaseOrder[]; vendors: Vendor[]; kpis: ComprasKPIs };

const KPI_CARDS = [
  { key: "openOrders" as const, label: "OC Abiertas", icon: FileText, color: "#3B82F6" },
  { key: "pendingApproval" as const, label: "Pend. Aprobación", icon: Clock, color: "#F59E0B" },
  { key: "inTransit" as const, label: "En Tránsito", icon: Truck, color: "#8B5CF6" },
  { key: "receivedToday" as const, label: "Recibidas Hoy", icon: PackageCheck, color: "#10B981" },
  { key: "totalMonthAmount" as const, label: "Total del Mes", icon: DollarSign, color: "#F97316", isCurrency: true },
];

const PIPELINE_STAGES: { id: PurchaseOrderStatus; label: string; color: string }[] = [
  { id: "draft", label: "Borrador", color: "#6B7280" },
  { id: "pending_approval", label: "Aprobación", color: "#F59E0B" },
  { id: "approved", label: "Aprobada", color: "#3B82F6" },
  { id: "sent", label: "Enviada", color: "#8B5CF6" },
  { id: "partially_received", label: "Parcial", color: "#F97316" },
  { id: "received", label: "Recibida", color: "#10B981" },
  { id: "invoiced", label: "Facturada", color: "#06B6D4" },
  { id: "closed", label: "Cerrada", color: "#6B7280" },
];

export function DashboardTab({ orders, vendors, kpis }: Props) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    PIPELINE_STAGES.forEach((s) => { counts[s.id] = { count: 0, total: 0 }; });
    orders.forEach((o) => {
      if (counts[o.status]) {
        counts[o.status].count++;
        counts[o.status].total += Number(o.total) || 0;
      }
    });
    return counts;
  }, [orders]);

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    orders.forEach((o) => {
      const v = vendors.find((vn) => vn.id === o.vendor_id);
      const cat = v?.category || "otros";
      cats[cat] = (cats[cat] || 0) + (Number(o.total) || 0);
    });
    const total = Object.values(cats).reduce((s, v) => s + v, 0);
    return Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({
        category: cat,
        label: VENDOR_CATEGORY_LABELS[cat as keyof typeof VENDOR_CATEGORY_LABELS] || cat,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }));
  }, [orders, vendors]);

  const topVendors = useMemo(() => {
    const vendorTotals: Record<string, { vendor: Vendor; total: number; count: number }> = {};
    orders.forEach((o) => {
      const v = vendors.find((vn) => vn.id === o.vendor_id);
      if (v) {
        if (!vendorTotals[v.id]) vendorTotals[v.id] = { vendor: v, total: 0, count: 0 };
        vendorTotals[v.id].total += Number(o.total) || 0;
        vendorTotals[v.id].count++;
      }
    });
    return Object.values(vendorTotals).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [orders, vendors]);

  const catColors = ["#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EF4444", "#F59E0B", "#06B6D4"];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_CARDS.map((card, i) => {
          const value = kpis[card.key];
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-all hover:shadow-lg"
            >
              <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: `radial-gradient(circle at 50% 0%, ${card.color}08, transparent 70%)` }} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg p-2" style={{ backgroundColor: `${card.color}15` }}>
                    <card.icon size={16} style={{ color: card.color }} />
                  </div>
                  <TrendingUp size={12} className="text-emerald-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                  {(card as { isCurrency?: boolean }).isCurrency
                    ? `$${(value / 1000).toFixed(0)}K`
                    : value}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">{card.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pipeline Visual */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
      >
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Pipeline de Órdenes de Compra</h3>
        <div className="flex items-center gap-1 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-2 px-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const data = pipelineCounts[stage.id];
            // Get top orders for this stage
            const stageOrders = orders
              .filter((o) => o.status === stage.id)
              .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
              .slice(0, 4);
            const avgValue = data.count > 0 ? data.total / data.count : 0;
            const stageVendors = new Set(stageOrders.map((o) => o.vendor_id)).size;

            return (
              <div key={stage.id} className="flex items-center shrink-0 snap-start">
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.06 }}
                    className="flex min-w-[100px] flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3 transition-all hover:shadow-md cursor-pointer"
                    style={{ borderColor: data.count > 0 ? `${stage.color}40` : undefined }}
                    onMouseEnter={() => setHoveredStage(stage.id)}
                    onMouseLeave={() => setHoveredStage(null)}
                  >
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="mt-2 text-lg font-bold text-[var(--text-primary)]">{data.count}</span>
                    <span className="text-[9px] font-medium text-[var(--text-muted)]">{stage.label}</span>
                    {data.total > 0 && (
                      <span className="mt-1 text-[8px] text-[var(--text-muted)]">
                        ${(data.total / 1000).toFixed(0)}K
                      </span>
                    )}
                  </motion.div>

                  {/* Hover popover with stage details */}
                  <AnimatePresence>
                    {hoveredStage === stage.id && data.count > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl"
                      >
                        {/* Arrow */}
                        <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[var(--border)] bg-[var(--bg-elevated)]" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{stage.label}</span>
                            <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)]">{data.count} OC</span>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="rounded-lg bg-[var(--bg-muted)]/50 p-2">
                              <p className="text-[9px] text-[var(--text-muted)]">Valor total</p>
                              <p className="text-xs font-bold font-mono text-[var(--text-primary)]">
                                ${(data.total / 1000).toFixed(1)}K
                              </p>
                            </div>
                            <div className="rounded-lg bg-[var(--bg-muted)]/50 p-2">
                              <p className="text-[9px] text-[var(--text-muted)]">Promedio/OC</p>
                              <p className="text-xs font-bold font-mono text-[var(--text-primary)]">
                                ${(avgValue / 1000).toFixed(1)}K
                              </p>
                            </div>
                          </div>

                          {/* Top orders in stage */}
                          {stageOrders.length > 0 && (
                            <div>
                              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 font-semibold">Órdenes principales</p>
                              <div className="space-y-1.5">
                                {stageOrders.map((o) => {
                                  const v = vendors.find((vn) => vn.id === o.vendor_id);
                                  return (
                                    <div key={o.id} className="flex items-center gap-2">
                                      <div
                                        className="h-5 w-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                                        style={{ backgroundColor: stage.color }}
                                      >
                                        {v?.name.charAt(0) || "?"}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-[var(--text-primary)] truncate">
                                          {o.po_number} — {v?.name || "—"}
                                        </p>
                                      </div>
                                      <span className="text-[10px] font-mono font-semibold" style={{ color: stage.color }}>
                                        ${((Number(o.total) || 0) / 1000).toFixed(1)}K
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {stageVendors > 0 && (
                            <p className="mt-2 text-[9px] text-[var(--text-muted)]">
                              {stageVendors} proveedor{stageVendors > 1 ? "es" : ""} en esta etapa
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight size={14} className="mx-1 shrink-0 text-[var(--text-muted)]" />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Bottom Grid: Top Vendors + Categories */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top 5 Vendors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Top 5 Proveedores</h3>
          <div className="space-y-3">
            {topVendors.map((tv, i) => (
              <div key={tv.vendor.id} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-[var(--text-muted)]">{i + 1}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: PO_STATUS_COLORS[["draft","pending_approval","approved","sent","received"][i] as PurchaseOrderStatus] || "#6B7280" }}>
                  {tv.vendor.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">{tv.vendor.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{tv.count} órdenes</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">${(tv.total / 1000).toFixed(1)}K</p>
                  <div className="mt-1 flex items-center gap-1">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: tv.vendor.compliance_score >= 90 ? "#10B981" : tv.vendor.compliance_score >= 75 ? "#F59E0B" : "#EF4444" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${tv.vendor.compliance_score}%` }}
                        transition={{ delay: 0.8 + i * 0.1, duration: 0.6 }}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--text-muted)]">{tv.vendor.compliance_score}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Compras por Categoría</h3>
          <div className="space-y-3">
            {categoryBreakdown.slice(0, 6).map((cat, i) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: catColors[i % catColors.length] }} />
                    <span className="text-xs font-medium text-[var(--text-primary)]">{cat.label}</span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">${(cat.amount / 1000).toFixed(0)}K ({cat.percentage.toFixed(0)}%)</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: catColors[i % catColors.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.percentage}%` }}
                    transition={{ delay: 0.7 + i * 0.1, duration: 0.5 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
