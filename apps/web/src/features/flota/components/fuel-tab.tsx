"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Fuel, TrendingDown, Gauge, Anchor, BarChart3 } from "lucide-react";
import type { FuelLog } from "../types";

const FUEL_COLORS: Record<string, string> = {
  LSFO: "#0EA5E9",
  HFO: "#6B7280",
  MGO: "#10B981",
  VLSFO: "#8B5CF6",
  LNG: "#06B6D4",
};

type FuelTabProps = {
  fuelLogs: FuelLog[];
};

export function FuelTab({ fuelLogs }: FuelTabProps) {
  const [fuelFilter, setFuelFilter] = useState<string>("all");

  const navLogs = fuelLogs.filter((f) => f.consumption_rate_mt_day && f.consumption_rate_mt_day > 0);
  const portLogs = fuelLogs.filter((f) => f.port && f.quantity_mt > 0 && f.consumption_rate_mt_day === 0);
  const bunkerLogs = fuelLogs.filter((f) => f.quantity_mt < 0);

  const filtered = fuelFilter === "all" ? fuelLogs : fuelLogs.filter((f) => f.fuel_type === fuelFilter);

  // Calculations
  const latestROB = fuelLogs.find((f) => f.rob_after && f.rob_after > 0);
  const avgConsumption = navLogs.length > 0
    ? navLogs.reduce((s, f) => s + (f.consumption_rate_mt_day || 0), 0) / navLogs.length : 0;
  const totalDistance = navLogs.reduce((s, f) => s + (f.distance_nm || 0), 0);
  const totalConsumed = navLogs.reduce((s, f) => s + (f.quantity_mt || 0), 0);
  const avgSpeed = navLogs.length > 0
    ? navLogs.reduce((s, f) => s + (f.avg_speed_kts || 0), 0) / navLogs.length : 0;
  const autonomyDays = avgConsumption > 0 && latestROB ? Math.floor((latestROB.rob_after || 0) / avgConsumption) : 0;
  const totalFuelCost = fuelLogs.filter((f) => f.quantity_mt < 0).reduce((s, f) => s + Math.abs(f.quantity_mt) * (f.price_per_mt || 0), 0);

  // Fuel types used
  const fuelTypes = [...new Set(fuelLogs.map((f) => f.fuel_type))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Fuel size={16} className="text-orange-500" />
        <h2 className="text-sm font-bold text-[var(--text-primary)]">Combustible y Eficiencia</h2>
        <span className="text-[10px] text-[var(--text-muted)]">({fuelLogs.length} registros)</span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: "ROB Total", value: `${(latestROB?.rob_after || 0).toFixed(0)} MT`, color: "#F97316", icon: Fuel },
          { label: "Consumo Prom.", value: `${avgConsumption.toFixed(1)} MT/d`, color: "#0EA5E9", icon: TrendingDown },
          { label: "Autonomía", value: `${autonomyDays} días`, color: "#10B981", icon: Gauge },
          { label: "Distancia Total", value: `${totalDistance.toLocaleString()} NM`, color: "#8B5CF6", icon: Anchor },
          { label: "Vel. Promedio", value: `${avgSpeed.toFixed(1)} kts`, color: "#06B6D4", icon: BarChart3 },
          { label: "Costo Bunkering", value: `$${(totalFuelCost / 1000).toFixed(1)}k`, color: "#F59E0B", icon: Fuel },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <kpi.icon size={13} style={{ color: kpi.color }} />
            <p className="text-lg font-bold tabular-nums mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-[9px] text-[var(--text-muted)]">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Consumption Chart (bar) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Consumo Diario — Últimos {navLogs.length} Días de Navegación
        </h3>
        <div className="flex items-end gap-1 h-32">
          {navLogs.slice(0, 30).reverse().map((f, i) => {
            const maxConsumption = Math.max(...navLogs.map((l) => l.consumption_rate_mt_day || 0));
            const h = f.consumption_rate_mt_day ? (f.consumption_rate_mt_day / maxConsumption) * 100 : 0;
            const color = FUEL_COLORS[f.fuel_type] || "#6B7280";
            return (
              <motion.div
                key={f.id}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.02, duration: 0.5 }}
                className="flex-1 rounded-t-sm cursor-help relative group"
                style={{ backgroundColor: color, minWidth: 4 }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] shadow-lg px-3 py-2 whitespace-nowrap text-[9px]">
                    <p className="font-bold text-[var(--text-primary)]">{f.consumption_rate_mt_day} MT/d</p>
                    <p className="text-[var(--text-muted)]">{f.log_date} · {f.fuel_type}</p>
                    <p className="text-[var(--text-muted)]">{f.avg_speed_kts} kts · {f.distance_nm} NM</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          {fuelTypes.map((type) => (
            <div key={type} className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FUEL_COLORS[type] || "#6B7280" }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Fuel Type Filter + Log Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Registro de Combustible
          </h3>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button
              onClick={() => setFuelFilter("all")}
              className={`rounded-md px-3 py-1 text-[10px] font-medium transition-all ${fuelFilter === "all" ? "bg-[#0EA5E9] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              Todos
            </button>
            {fuelTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFuelFilter(type)}
                className={`rounded-md px-3 py-1 text-[10px] font-medium transition-all ${fuelFilter === type ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                style={fuelFilter === type ? { backgroundColor: FUEL_COLORS[type] || "#6B7280" } : {}}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="pb-2 text-left font-bold uppercase tracking-wider text-[var(--text-muted)]">Fecha</th>
                <th className="pb-2 text-left font-bold uppercase tracking-wider text-[var(--text-muted)]">Tipo</th>
                <th className="pb-2 text-right font-bold uppercase tracking-wider text-[var(--text-muted)]">Cantidad</th>
                <th className="pb-2 text-right font-bold uppercase tracking-wider text-[var(--text-muted)]">Consumo</th>
                <th className="pb-2 text-right font-bold uppercase tracking-wider text-[var(--text-muted)]">ROB</th>
                <th className="pb-2 text-right font-bold uppercase tracking-wider text-[var(--text-muted)]">Velocidad</th>
                <th className="pb-2 text-right font-bold uppercase tracking-wider text-[var(--text-muted)]">Distancia</th>
                <th className="pb-2 text-left font-bold uppercase tracking-wider text-[var(--text-muted)]">Puerto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 30).map((log) => (
                <tr key={log.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-muted)]/30 transition-colors">
                  <td className="py-2 text-[var(--text-primary)] tabular-nums">{log.log_date}</td>
                  <td className="py-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold text-white" style={{ backgroundColor: FUEL_COLORS[log.fuel_type] || "#6B7280" }}>
                      {log.fuel_type}
                    </span>
                  </td>
                  <td className={`py-2 text-right tabular-nums font-medium ${log.quantity_mt < 0 ? "text-emerald-500" : "text-[var(--text-primary)]"}`}>
                    {log.quantity_mt < 0 ? `+${Math.abs(log.quantity_mt)}` : log.quantity_mt} MT
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                    {log.consumption_rate_mt_day ? `${log.consumption_rate_mt_day} MT/d` : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                    {log.rob_after ? `${log.rob_after.toFixed(0)} MT` : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                    {log.avg_speed_kts ? `${log.avg_speed_kts} kts` : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                    {log.distance_nm ? `${log.distance_nm} NM` : "—"}
                  </td>
                  <td className="py-2 text-[var(--text-muted)]">{log.port || "En ruta"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
