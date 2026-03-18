"use client";

import type { KPISnapshot, Equipment, WorkOrder } from "../types";
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS } from "../types";

export function AnalyticsTab({ kpis, equipment, workOrders }: { kpis: KPISnapshot[]; equipment: Equipment[]; workOrders: WorkOrder[] }) {
  const criticalEquipment = equipment.filter((e) => e.criticality === "critical");
  const woByCost = workOrders.filter((w) => w.cost_estimated > 0).sort((a, b) => b.cost_estimated - a.cost_estimated).slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Availability Trend */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Tendencia Disponibilidad
        </h3>
        <div className="flex items-end gap-3 h-32">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-[#10B981]" style={{ height: `${kpi.availability_pct}%` }} />
              <span className="text-[8px] text-[var(--text-muted)]">
                {new Date(kpi.snapshot_date).toLocaleDateString("es-EC", { month: "short" })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* MTBF Trend */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Tendencia MTBF (horas)
        </h3>
        <div className="flex items-end gap-3 h-32">
        {(() => {
          const maxMTBF = Math.max(...kpis.map((k) => k.mtbf_hours));
          return kpis.map((kpi) => (
            <div key={kpi.id} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-[#0EA5E9]" style={{ height: `${(kpi.mtbf_hours / maxMTBF) * 100}%` }} />
              <span className="text-[8px] text-[var(--text-muted)]">
                {new Date(kpi.snapshot_date).toLocaleDateString("es-EC", { month: "short" })}
              </span>
            </div>
          ));
        })()}
        </div>
      </div>

      {/* Critical Equipment Status */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Equipos Críticos ({criticalEquipment.length})
        </h3>
        <div className="space-y-1.5">
          {criticalEquipment.map((eq) => (
            <div key={eq.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
              <div>
                <p className="text-[11px] font-medium text-[var(--text-primary)]">{eq.name}</p>
                <p className="text-[9px] font-mono text-[var(--text-muted)]">{eq.code}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{ backgroundColor: `${EQUIPMENT_STATUS_COLORS[eq.status]}15`, color: EQUIPMENT_STATUS_COLORS[eq.status] }}>
                {EQUIPMENT_STATUS_LABELS[eq.status]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top WOs by Cost */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Top OTs por Costo Estimado
        </h3>
        <div className="space-y-1.5">
          {woByCost.map((wo) => (
            <div key={wo.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
              <div>
                <p className="text-[11px] font-medium text-[var(--text-primary)]">{wo.title}</p>
                <p className="text-[9px] font-mono text-[#0EA5E9]">{wo.wo_number}</p>
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)]">${wo.cost_estimated.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
