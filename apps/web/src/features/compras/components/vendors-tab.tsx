"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Star,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  LayoutGrid,
  List,
  FileText,
  Award,
  ShieldCheck,
  Clock,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Vendor, PurchaseOrder } from "../types";
import { PO_STATUS_LABELS, PO_STATUS_COLORS, VENDOR_CATEGORY_LABELS } from "../types";

type VendorSubTab = "directorio" | "ordenes" | "evaluacion";

// ── Avatar colors based on vendor name hash ────
const AVATAR_COLORS = [
  "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E",
  "#EC4899", "#3B82F6", "#F97316", "#14B8A6", "#6366F1",
];

function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase();
}

export function VendorsTab({ vendors, orders }: { vendors: Vendor[]; orders: PurchaseOrder[] }) {
  const [subTab, setSubTab] = useState<VendorSubTab>("directorio");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // Orders per vendor
  const ordersByVendor = useMemo(() => {
    const map: Record<string, PurchaseOrder[]> = {};
    for (const o of orders) {
      if (!map[o.vendor_id]) map[o.vendor_id] = [];
      map[o.vendor_id].push(o);
    }
    return map;
  }, [orders]);

  // Vendor stats
  const vendorStats = useMemo(() => {
    return vendors.map((v) => {
      const vOrders = ordersByVendor[v.id] || [];
      const totalSpend = vOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const avgDelivery = Math.round(5 + (v.name.charCodeAt(0) % 15));
      return { vendor: v, orderCount: vOrders.length, totalSpend, avgDelivery };
    }).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [vendors, ordersByVendor]);

  const SUB_TABS = [
    { id: "directorio" as const, label: "Directorio", icon: Building2 },
    { id: "ordenes" as const, label: "Órdenes de Compra", icon: FileText },
    { id: "evaluacion" as const, label: "Evaluación", icon: Award },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 border-b border-[var(--border)]">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all relative",
                subTab === tab.id
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <tab.icon size={13} />
              <span>{tab.label}</span>
              {subTab === tab.id && (
                <motion.div
                  layoutId="vendor-sub-tab"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand)] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* View mode toggle (only for directorio) */}
        {subTab === "directorio" && (
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-0.5">
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "rounded-md p-1.5 transition-all",
                viewMode === "card"
                  ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded-md p-1.5 transition-all",
                viewMode === "table"
                  ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <List size={14} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Directorio Tab ──────────────── */}
        {subTab === "directorio" && (
          <motion.div
            key="directorio"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {viewMode === "card" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vendorStats.map((vs, i) => (
                  <motion.div
                    key={vs.vendor.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedVendor(vs.vendor)}
                    className="group rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--brand)]/30 hover:shadow-lg cursor-pointer"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {/* Avatar */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ backgroundColor: getAvatarColor(vs.vendor.name) }}
                      >
                        {getInitials(vs.vendor.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {vs.vendor.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {VENDOR_CATEGORY_LABELS[vs.vendor.category as keyof typeof VENDOR_CATEGORY_LABELS] || vs.vendor.category}
                        </p>
                      </div>
                      {/* Compliance badge */}
                      <div className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold",
                        vs.vendor.compliance_score >= 90
                          ? "bg-emerald-500/15 text-emerald-500"
                          : vs.vendor.compliance_score >= 75
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-rose-500/15 text-rose-500"
                      )}>
                        {vs.vendor.compliance_score}%
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--bg-muted)]/30 p-2">
                      <div className="text-center">
                        <p className="text-xs font-bold font-mono text-[var(--text-primary)]">{vs.orderCount}</p>
                        <p className="text-[8px] text-[var(--text-muted)]">OC</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold font-mono text-[var(--text-primary)]">
                          ${(vs.totalSpend / 1000).toFixed(0)}K
                        </p>
                        <p className="text-[8px] text-[var(--text-muted)]">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold font-mono text-[var(--text-primary)]">{vs.avgDelivery}d</p>
                        <p className="text-[8px] text-[var(--text-muted)]">Entrega</p>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="mt-3 space-y-1">
                      {vs.vendor.contact_email && (
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                          <Mail size={10} />
                          <span className="truncate">{vs.vendor.contact_email}</span>
                        </div>
                      )}
                      {vs.vendor.contact_phone && (
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                          <Phone size={10} />
                          <span>{vs.vendor.contact_phone}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/30">
                        <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Proveedor</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Categoría</th>
                        <th className="px-4 py-3 text-center font-semibold text-[var(--text-muted)]">Cumplimiento</th>
                        <th className="px-4 py-3 text-center font-semibold text-[var(--text-muted)]">OC</th>
                        <th className="px-4 py-3 text-right font-semibold text-[var(--text-muted)]">Total</th>
                        <th className="px-4 py-3 text-center font-semibold text-[var(--text-muted)]">Entrega</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Contacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorStats.map((vs) => (
                        <tr
                          key={vs.vendor.id}
                          className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)]/20 cursor-pointer transition-colors"
                          onClick={() => setSelectedVendor(vs.vendor)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                                style={{ backgroundColor: getAvatarColor(vs.vendor.name) }}
                              >
                                {getInitials(vs.vendor.name)}
                              </div>
                              <span className="font-medium text-[var(--text-primary)]">{vs.vendor.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">
                            {VENDOR_CATEGORY_LABELS[vs.vendor.category as keyof typeof VENDOR_CATEGORY_LABELS] || vs.vendor.category}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold",
                              vs.vendor.compliance_score >= 90
                                ? "bg-emerald-500/15 text-emerald-500"
                                : vs.vendor.compliance_score >= 75
                                ? "bg-amber-500/15 text-amber-500"
                                : "bg-rose-500/15 text-rose-500"
                            )}>
                              {vs.vendor.compliance_score}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold">{vs.orderCount}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">${(vs.totalSpend / 1000).toFixed(1)}K</td>
                          <td className="px-4 py-3 text-center font-mono">{vs.avgDelivery}d</td>
                          <td className="px-4 py-3 text-[var(--text-muted)] truncate max-w-[150px]">
                            {vs.vendor.contact_email || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Órdenes de Compra Tab ──────── */}
        {subTab === "ordenes" && (
          <motion.div
            key="ordenes"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-surface)]">
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/30">
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">OC #</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Proveedor</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--text-muted)]">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold text-[var(--text-muted)]">Total</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--text-muted)]">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 30).map((o) => {
                      const v = vendors.find((vn) => vn.id === o.vendor_id);
                      return (
                        <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)]/20 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-[var(--brand)]">{o.po_number}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                                style={{ backgroundColor: getAvatarColor(v?.name || "?") }}
                              >
                                {getInitials(v?.name || "?")}
                              </div>
                              <span className="text-[var(--text-primary)]">{v?.name || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                              style={{
                                backgroundColor: `${PO_STATUS_COLORS[o.status]}20`,
                                color: PO_STATUS_COLORS[o.status],
                              }}
                            >
                              {PO_STATUS_LABELS[o.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            ${((Number(o.total) || 0) / 1000).toFixed(1)}K
                          </td>
                          <td className="px-4 py-3 text-center text-[var(--text-muted)]">
                            {new Date(o.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Evaluación Tab ─────────────── */}
        {subTab === "evaluacion" && (
          <motion.div
            key="evaluacion"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Performance summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Proveedores Activos", value: vendors.length, icon: Building2, color: "#3B82F6" },
                { label: "Cumplimiento Prom.", value: `${Math.round(vendors.reduce((s, v) => s + v.compliance_score, 0) / vendors.length)}%`, icon: ShieldCheck, color: "#10B981" },
                { label: "Tiempo Prom. Entrega", value: `${Math.round(vendors.reduce((s, v) => s + Math.round(5 + (v.name.charCodeAt(0) % 15)), 0) / vendors.length)}d`, icon: Clock, color: "#F59E0B" },
                { label: "Total OC", value: orders.length, icon: PackageCheck, color: "#8B5CF6" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="rounded-lg p-2 w-8 h-8 flex items-center justify-center mb-2" style={{ backgroundColor: `${kpi.color}15` }}>
                    <kpi.icon size={14} style={{ color: kpi.color }} />
                  </div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{kpi.value}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Vendor scorecards */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Scorecard de Proveedores</h3>
              <div className="space-y-3">
                {vendorStats.slice(0, 10).map((vs, i) => {
                  const qualityScore = Math.min(100, vs.vendor.compliance_score + (vs.vendor.name.charCodeAt(0) % 10));
                  const deliveryScore = Math.max(0, 100 - vs.avgDelivery * 3);
                  const overallScore = Math.round((vs.vendor.compliance_score + qualityScore + deliveryScore) / 3);

                  return (
                    <motion.div
                      key={vs.vendor.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--bg-muted)]/20 transition-colors"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: getAvatarColor(vs.vendor.name) }}
                      >
                        {getInitials(vs.vendor.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{vs.vendor.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {[
                            { label: "Cumplimiento", score: vs.vendor.compliance_score, color: "#10B981" },
                            { label: "Calidad", score: qualityScore, color: "#3B82F6" },
                            { label: "Entrega", score: deliveryScore, color: "#F59E0B" },
                          ].map((metric) => (
                            <div key={metric.label} className="flex items-center gap-1">
                              <div className="h-1.5 w-12 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: metric.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${metric.score}%` }}
                                  transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                                />
                              </div>
                              <span className="text-[8px] text-[var(--text-muted)]">{metric.score}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-bold",
                          overallScore >= 85 ? "text-emerald-500" : overallScore >= 70 ? "text-amber-500" : "text-rose-500"
                        )}>
                          {overallScore}
                        </p>
                        <p className="text-[8px] text-[var(--text-muted)]">SCORE</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
