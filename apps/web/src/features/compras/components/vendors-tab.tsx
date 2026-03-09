"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Star, Clock, Package, TrendingUp } from "lucide-react";
import type { PurchaseOrder, Vendor } from "../types";
import { VENDOR_CATEGORY_LABELS } from "../types";

type Props = { vendors: Vendor[]; orders: PurchaseOrder[] };

export function VendorsTab({ vendors, orders }: Props) {
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q) || v.code.toLowerCase().includes(q));
  }, [vendors, search]);

  const vendorStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    orders.forEach((o) => {
      if (!stats[o.vendor_id]) stats[o.vendor_id] = { count: 0, total: 0 };
      stats[o.vendor_id].count++;
      stats[o.vendor_id].total += Number(o.total) || 0;
    });
    return stats;
  }, [orders]);

  const vendorOrders = useMemo(() => {
    if (!selectedVendor) return [];
    return orders.filter((o) => o.vendor_id === selectedVendor.id).slice(0, 10);
  }, [orders, selectedVendor]);

  const scoreColor = (score: number) => score >= 90 ? "#10B981" : score >= 75 ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-orange-500/50" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((vendor, i) => {
          const stats = vendorStats[vendor.id] || { count: 0, total: 0 };
          return (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedVendor(vendor)}
              className="group cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-all hover:shadow-lg hover:border-orange-500/30"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold text-white shadow-lg">
                  {vendor.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{vendor.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{vendor.code} · {VENDOR_CATEGORY_LABELS[vendor.category || "servicios"] || vendor.category}</p>
                </div>
                {vendor.is_active && <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1" />}
              </div>

              <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1"><MapPin size={10} />{vendor.city}</span>
                <span className="flex items-center gap-1"><Clock size={10} />{vendor.avg_lead_time_days}d</span>
                <span className="flex items-center gap-1"><Package size={10} />{stats.count} OC</span>
              </div>

              {/* Scorecard */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Cumplimiento", value: vendor.compliance_score },
                  { label: "Calidad", value: vendor.quality_score },
                  { label: "Rating", value: (Number(vendor.rating) / 5) * 100 },
                ].map((metric) => (
                  <div key={metric.label} className="text-center">
                    <div className="relative mx-auto h-8 w-8">
                      <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-muted)" strokeWidth="3" />
                        <motion.circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${metric.value * 0.942} 94.2`}
                          stroke={scoreColor(metric.value)}
                          initial={{ strokeDasharray: "0 94.2" }}
                          animate={{ strokeDasharray: `${metric.value * 0.942} 94.2` }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-[var(--text-primary)]">
                        {metric.label === "Rating" ? `${Number(vendor.rating).toFixed(1)}` : `${metric.value}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[7px] text-[var(--text-muted)]">{metric.label}</p>
                  </div>
                ))}
              </div>

              {stats.total > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2">
                  <span className="text-[10px] text-[var(--text-muted)]">Vol. total</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">${(stats.total / 1000).toFixed(1)}K</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Vendor Detail Sheet */}
      {selectedVendor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
          onClick={() => setSelectedVendor(null)}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full w-full max-w-md overflow-y-auto bg-[var(--bg-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-xl font-bold text-white">
                  {selectedVendor.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">{selectedVendor.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">{selectedVendor.legal_name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">RUC: {selectedVendor.tax_id}</p>
                </div>
              </div>

              {/* Gauges */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Cumplimiento", value: selectedVendor.compliance_score, suffix: "%" },
                  { label: "Calidad", value: selectedVendor.quality_score, suffix: "%" },
                  { label: "Lead Time", value: selectedVendor.avg_lead_time_days, suffix: " días" },
                ].map((g) => (
                  <div key={g.label} className="rounded-xl border border-[var(--border)] p-3 text-center">
                    <p className="text-xl font-bold text-[var(--text-primary)]">{g.value}{g.suffix}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{g.label}</p>
                  </div>
                ))}
              </div>

              {/* Contact */}
              <div className="rounded-xl border border-[var(--border)] p-3 space-y-1 text-xs">
                <p className="font-medium text-[var(--text-primary)]">{selectedVendor.contact_name}</p>
                <p className="text-[var(--text-muted)]">{selectedVendor.contact_email}</p>
                <p className="text-[var(--text-muted)]">{selectedVendor.contact_phone}</p>
                <p className="text-[var(--text-muted)]">{selectedVendor.address}, {selectedVendor.city}</p>
              </div>

              {/* Recent Orders */}
              <div>
                <p className="mb-2 text-[10px] font-semibold text-[var(--text-muted)]">ÚLTIMAS ÓRDENES</p>
                <div className="space-y-1.5">
                  {vendorOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                      <span className="font-mono text-[10px] text-orange-500">{o.po_number}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{o.order_date ? new Date(o.order_date).toLocaleDateString("es-EC") : "—"}</span>
                      <span className="text-[10px] font-semibold text-[var(--text-primary)]">${Number(o.total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
