"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp, ArrowDown, Minus, MapPin, Activity,
} from "lucide-react";
import type { KPISnapshot, WorkOrder, Equipment, VesselZone } from "../types";
import {
  WO_PRIORITY_LABELS, WO_PRIORITY_COLORS,
  WO_STATUS_LABELS, WO_STATUS_COLORS,
  ZONE_TYPE_COLORS,
} from "../types";
import type { useFlotaDemo } from "../hooks/use-flota-demo";

const VesselMap = dynamic(() => import("./vessel-map").then((m) => m.VesselMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[350px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="flex flex-col items-center gap-2">
        <MapPin size={20} className="text-[var(--text-muted)] animate-pulse" />
        <span className="text-[10px] text-[var(--text-muted)]">Cargando mapa...</span>
      </div>
    </div>
  ),
});

type DashboardTabProps = {
  kpis: KPISnapshot[];
  workOrders: WorkOrder[];
  equipment: Equipment[];
  zones: VesselZone[];
  events: ReturnType<typeof useFlotaDemo>["events"];
  readings: ReturnType<typeof useFlotaDemo>["readings"];
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <ArrowUp size={10} className="text-red-400" />;
  if (trend === "down") return <ArrowDown size={10} className="text-green-400" />;
  return <Minus size={10} className="text-[var(--text-muted)]" />;
}

export function DashboardTab({ kpis, workOrders, equipment, zones, events, readings }: DashboardTabProps) {
  const activeWOs = workOrders.filter((wo) => ["in_progress", "assigned"].includes(wo.status)).slice(0, 5);
  const zoneEquipmentCounts = zones.map((z) => ({
    ...z,
    count: equipment.filter((e) => e.zone_id === z.id).length,
    alerts: equipment.filter((e) => e.zone_id === z.id && e.status !== "operational").length,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Live Readings — Realtime — Full Width ── */}
      <div className="lg:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0EA5E9]">
            <Activity size={13} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
            Lecturas en Tiempo Real
          </h3>
          <span className="text-[9px] text-[var(--text-muted)]">Actualización cada 3s</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {readings.slice(0, 8).map((r) => (
            <motion.div
              key={r.name}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3 transition-colors"
              animate={{
                borderColor: r.trend !== "stable" ? "rgba(14,165,233,0.3)" : undefined,
              }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{r.name}</span>
                <TrendIcon trend={r.trend} />
              </div>
              <p className="text-xl font-bold tabular-nums leading-tight" style={{ color: r.color }}>
                {r.value.toFixed(1)}
                <span className="text-[10px] font-normal text-[var(--text-muted)] ml-1">{r.unit}</span>
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Live Event Feed ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 max-h-[350px] overflow-hidden">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Feed en Vivo
        </h3>
        <div className="space-y-1.5 overflow-y-auto max-h-[280px] pr-1">
          <AnimatePresence initial={false}>
            {events.slice(0, 10).map((evt) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-md bg-[var(--bg-muted)]/30 px-2 py-1.5"
              >
                <span className="text-[10px] shrink-0 mt-0.5">{evt.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-[var(--text-primary)] truncate">{evt.title}</p>
                  <p className="text-[8px] text-[var(--text-muted)] truncate">{evt.detail}</p>
                </div>
                <span className="text-[7px] text-[var(--text-muted)] shrink-0">
                  {evt.timestamp.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Zones Overview ── */}
      <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Zonas del Buque
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {zoneEquipmentCounts.filter((z) => z.count > 0).map((z) => (
            <div key={z.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ZONE_TYPE_COLORS[z.zone_type] }} />
                <span className="text-[11px] font-medium text-[var(--text-primary)]">{z.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)]">{z.count} eq.</span>
                {z.alerts > 0 && (
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[8px] font-bold text-red-500">
                    {z.alerts} ⚠
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Vessel Map — CesiumJS Globe ── */}
      <div className="lg:col-span-3">
        <VesselMap compact />
      </div>

      {/* ── Active Work Orders ── */}
      <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Órdenes de Trabajo Activas
        </h3>
        <div className="space-y-2">
          {activeWOs.map((wo) => (
            <div key={wo.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/50 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#0EA5E9]">{wo.wo_number}</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                    style={{ backgroundColor: `${WO_PRIORITY_COLORS[wo.priority]}15`, color: WO_PRIORITY_COLORS[wo.priority] }}
                  >
                    {WO_PRIORITY_LABELS[wo.priority]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)] truncate">{wo.title}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium"
                style={{ backgroundColor: `${WO_STATUS_COLORS[wo.status]}15`, color: WO_STATUS_COLORS[wo.status] }}
              >
                {WO_STATUS_LABELS[wo.status]}
              </span>
            </div>
          ))}
          {activeWOs.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--text-muted)]">No hay OT activas</p>
          )}
        </div>
      </div>

      {/* ── KPI Trend — Full Width ── */}
      <div className="lg:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Tendencia KPIs — Últimos 6 Meses
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="rounded-lg bg-[var(--bg-muted)]/30 p-3 text-center">
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {new Date(kpi.snapshot_date).toLocaleDateString("es-EC", { month: "short", year: "2-digit" })}
              </p>
              <div className="mt-2 flex items-center justify-center gap-4">
                <div>
                  <p className="text-lg font-bold text-[#10B981]">{kpi.availability_pct}%</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Disponibilidad</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#0EA5E9]">{kpi.mtbf_hours}h</p>
                  <p className="text-[9px] text-[var(--text-muted)]">MTBF</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="rounded-full bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-medium text-[#F59E0B]">
                  ${(kpi.maintenance_cost / 1000).toFixed(1)}k
                </div>
                <span className="text-[8px] text-[var(--text-muted)]">Costo Mant.</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
