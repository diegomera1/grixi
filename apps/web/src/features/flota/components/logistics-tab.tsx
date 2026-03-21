"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Package, AlertTriangle, Search, TrendingDown, Box, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Equipment } from "../types";

type FilterType = "all" | "critical_low" | "critical" | "low_stock";

export function LogisticsTab({ equipment }: { equipment: Equipment[] }) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState("all");

  const allBOM = equipment.flatMap((eq) =>
    (eq.bom_items || []).map((item) => ({ ...item, equipmentCode: eq.code, equipmentName: eq.name }))
  );

  const criticalLow = allBOM.filter((b) => b.critical && b.quantity_onboard < b.quantity_required);
  const lowStock = allBOM.filter((b) => b.quantity_onboard < b.quantity_required);
  const totalValue = allBOM.reduce((sum, b) => sum + (b.quantity_onboard * 50), 0); // Estimated value

  const displayed = allBOM.filter((item) => {
    if (filter === "critical_low" && !(item.critical && item.quantity_onboard < item.quantity_required)) return false;
    if (filter === "critical" && !item.critical) return false;
    if (filter === "low_stock" && item.quantity_onboard >= item.quantity_required) return false;
    if (selectedEquipment !== "all" && item.equipmentCode !== selectedEquipment) return false;
    if (search && !item.description.toLowerCase().includes(search.toLowerCase()) && !item.part_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <Package size={16} className="text-amber-500" />
          Logística y Repuestos
          <span className="text-[10px] font-normal text-[var(--text-muted)]">({allBOM.length} items)</span>
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
          <Box size={14} className="mx-auto text-[#0EA5E9] mb-1" />
          <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">{allBOM.length}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Total Items</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center cursor-pointer hover:bg-red-500/10 transition-colors" onClick={() => setFilter("critical_low")}>
          <AlertTriangle size={14} className="mx-auto text-red-500 mb-1" />
          <p className="text-xl font-bold tabular-nums text-red-500">{criticalLow.length}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-red-500 mt-0.5">Críticos Bajo Stock</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center cursor-pointer hover:bg-amber-500/10 transition-colors" onClick={() => setFilter("low_stock")}>
          <TrendingDown size={14} className="mx-auto text-amber-500 mb-1" />
          <p className="text-xl font-bold tabular-nums text-amber-500">{lowStock.length}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500 mt-0.5">Bajo Stock</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
          <DollarSign size={14} className="mx-auto text-emerald-500 mb-1" />
          <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">${(totalValue / 1000).toFixed(1)}k</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Valor Est.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción o part number..."
            className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs placeholder:text-[var(--text-muted)] focus:border-amber-500 focus:outline-none"
          />
        </div>
        <select
          value={selectedEquipment}
          onChange={(e) => setSelectedEquipment(e.target.value)}
          className="h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs"
        >
          <option value="all">Todos los equipos</option>
          {[...new Set(allBOM.map((b) => b.equipmentCode))].map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {([
            { value: "all", label: "Todos" },
            { value: "critical", label: "Críticos" },
            { value: "low_stock", label: "Bajo Stock" },
          ] as const).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                filter === f.value ? "bg-amber-500 text-white" : "border border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Item Cards */}
      <div className="space-y-2">
        {displayed.map((item, i) => {
          const isLow = item.quantity_onboard < item.quantity_required;
          const pct = item.quantity_required > 0 ? Math.round((item.quantity_onboard / item.quantity_required) * 100) : 100;
          const barColor = pct >= 80 ? "#10B981" : pct >= 40 ? "#F59E0B" : "#EF4444";

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.critical && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                    <span className="text-[10px] font-mono text-[#0EA5E9]">{item.part_number}</span>
                    <span className="text-[9px] text-[var(--text-muted)]">· {item.equipmentCode}</span>
                  </div>
                  <h4 className="text-xs font-medium text-[var(--text-primary)]">{item.description}</h4>
                  <div className="flex items-center gap-3 mt-2 text-[9px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><Clock size={9} /> {item.lead_time_days}d lead time</span>
                    <span>{item.equipmentName}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className={cn("text-sm font-bold tabular-nums", isLow ? "text-red-500" : "text-[var(--text-primary)]")}>
                    {item.quantity_onboard} / {item.quantity_required}
                  </p>
                  <div className="h-1.5 rounded-full bg-[var(--bg-muted)] mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                  </div>
                  <p className="text-[8px] text-[var(--text-muted)] mt-0.5">{pct}% stock</p>
                </div>
              </div>
            </motion.div>
          );
        })}
        {displayed.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <Package size={32} className="text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No se encontraron items</p>
          </div>
        )}
      </div>
    </div>
  );
}
