"use client";

import { motion } from "framer-motion";
import { Ship, Plus, Anchor, Activity, Wrench, Users } from "lucide-react";
import type { Vessel, FlotaKPIs } from "../types";
import { VESSEL_STATUS_LABELS, VESSEL_STATUS_COLORS } from "../types";

type VesselSelectorProps = {
  vessels: { vessel: Vessel; stats: FlotaKPIs }[];
  onSelect: (vesselId: string) => void;
};

export function VesselSelector({ vessels, onSelect }: VesselSelectorProps) {
  return (
    <div className="w-full min-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0EA5E9]/10">
            <Anchor size={22} className="text-[#0EA5E9]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Flota Marítima</h1>
            <p className="text-xs text-[var(--text-muted)]">Selecciona un buque para gestionar su mantenimiento</p>
          </div>
        </div>
      </div>

      {/* Vessel Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vessels.map(({ vessel, stats }, i) => {
          const statusColor = VESSEL_STATUS_COLORS[vessel.status] || "#6B7280";
          return (
            <motion.button
              key={vessel.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onSelect(vessel.id)}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-0 text-left transition-all hover:border-[#0EA5E9]/50 hover:shadow-lg hover:shadow-[#0EA5E9]/5"
            >
              {/* Top accent */}
              <div className="h-1.5 w-full" style={{ backgroundColor: statusColor }} />

              <div className="p-5">
                {/* Vessel identity */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0EA5E9]/10 group-hover:bg-[#0EA5E9]/15 transition-colors">
                      <Ship size={24} className="text-[#0EA5E9]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[#0EA5E9] transition-colors">{vessel.name}</h3>
                      <p className="text-[10px] text-[var(--text-muted)]">{vessel.imo_number} · {vessel.flag}</p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                  >
                    {VESSEL_STATUS_LABELS[vessel.status]}
                  </span>
                </div>

                {/* Quick KPIs */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Disp.", value: `${stats.availability}%`, icon: Activity, color: "#10B981" },
                    { label: "OTs", value: stats.openWOs, icon: Wrench, color: "#3B82F6" },
                    { label: "Alertas", value: stats.activeAlerts, icon: Activity, color: "#EF4444" },
                    { label: "Tripul.", value: stats.crewOnboard, icon: Users, color: "#F97316" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-2 text-center">
                      <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
                      <p className="text-[8px] text-[var(--text-muted)] mt-0.5">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* Specs */}
                <div className="mt-3 flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                  <span>{vessel.vessel_type.replace(/_/g, " ")}</span>
                  <span>·</span>
                  <span>{vessel.loa}m LOA</span>
                  <span>·</span>
                  <span>{vessel.dwt.toLocaleString()} DWT</span>
                  <span>·</span>
                  <span>{vessel.year_built}</span>
                </div>
              </div>
            </motion.button>
          );
        })}

        {/* Add vessel card (disabled) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: vessels.length * 0.1 }}
          className="flex min-h-[200px] cursor-not-allowed items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-surface)]/50 opacity-50"
        >
          <div className="text-center">
            <Plus size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
            <p className="text-xs font-medium text-[var(--text-muted)]">Agregar Buque</p>
            <p className="text-[9px] text-[var(--text-muted)] mt-1">Próximamente</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
