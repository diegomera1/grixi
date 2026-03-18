"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ship, Gauge, Wrench, ClipboardCheck, ClipboardList, Users, Package,
  BarChart3, Anchor, Activity, AlertTriangle,
  DollarSign, Clock, TrendingUp, Waves, Cpu,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useFlotaDemo } from "../hooks/use-flota-demo";
import { useOfflineSync } from "../hooks/use-offline-sync";
import { ChecklistTab } from "./checklist-tab";
import { AITab } from "./ai-tab";
import { OfflineIndicator } from "./offline-indicator";
import type {
  Vessel, VesselZone, Equipment, WorkOrder,
  Checklist, CrewMember, KPISnapshot, FlotaKPIs,
} from "../types";
import {
  VESSEL_STATUS_LABELS, VESSEL_STATUS_COLORS,
  WO_STATUS_LABELS, WO_STATUS_COLORS, WO_PRIORITY_LABELS, WO_PRIORITY_COLORS,
  EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_CRITICALITY_LABELS, EQUIPMENT_CRITICALITY_COLORS,
  ZONE_TYPE_COLORS,
} from "../types";

// Dynamic import to avoid SSR issues with R3F
const Vessel3D = dynamic(() => import("./vessel-3d").then((m) => m.Vessel3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-[450px] items-center justify-center rounded-xl border border-[var(--border)] bg-[#030712]">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 rounded-full border-2 border-[#0EA5E9] border-t-transparent animate-spin" />
        <span className="text-xs text-[#0EA5E9]/60">Cargando visualización 3D...</span>
      </div>
    </div>
  ),
});

// ── Tabs ────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "vessel-3d", label: "Buque 3D", icon: Waves },
  { id: "equipment", label: "Equipos", icon: Wrench },
  { id: "work-orders", label: "Órdenes", icon: ClipboardCheck },
  { id: "checklists", label: "Checklists", icon: ClipboardList },
  { id: "crew", label: "Tripulación", icon: Users },
  { id: "logistics", label: "Logística", icon: Package },
  { id: "analytics", label: "Analítica", icon: BarChart3 },
  { id: "ai", label: "AI Predictivo", icon: Cpu },
] as const;

type TabId = (typeof TABS)[number]["id"];

type FlotaData = {
  vessel: Vessel;
  zones: VesselZone[];
  equipment: Equipment[];
  workOrders: WorkOrder[];
  checklists: Checklist[];
  crew: CrewMember[];
  kpis: KPISnapshot[];
  stats: FlotaKPIs;
};

// ── Main Content ────────────────────────────────

export function FlotaContent({ data }: { data: FlotaData }) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [fullscreen3D, setFullscreen3D] = useState(false);
  const { vessel, zones, equipment, workOrders, checklists, crew, kpis, stats } = data;
  const { events, readings } = useFlotaDemo();
  const { status: offlineStatus, syncNow } = useOfflineSync();

  // Fullscreen 3D overlay
  if (fullscreen3D) {
    return (
      <Vessel3D
        zones={zones}
        equipment={equipment}
        fullscreenMode
        onToggleFullscreen={() => setFullscreen3D(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0EA5E9] shadow-lg shadow-[#0EA5E9]/20">
              <Ship size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--text-primary)]">{vessel.name}</h1>
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span>{vessel.imo_number}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: VESSEL_STATUS_COLORS[vessel.status] }} />
                  {VESSEL_STATUS_LABELS[vessel.status]}
                </span>
                <span>·</span>
                <span>{vessel.class_society}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <Anchor size={12} />
            <span>{vessel.port_of_registry} · {vessel.flag}</span>
            <span className="mx-1">|</span>
            <span>{vessel.loa}m × {vessel.beam}m · {vessel.dwt?.toLocaleString()} DWT</span>
          </div>
        </div>
      </motion.div>

      {/* KPI Hero Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: "Disponibilidad", value: `${stats.availability}%`, icon: Activity, color: "#10B981" },
          { label: "MTBF", value: `${stats.mtbf}h`, icon: TrendingUp, color: "#0EA5E9" },
          { label: "MTTR", value: `${stats.mttr}h`, icon: Clock, color: "#F59E0B" },
          { label: "OT Abiertas", value: stats.openWOs, icon: Wrench, color: "#3B82F6" },
          { label: "Alertas", value: stats.criticalAlerts, icon: AlertTriangle, color: "#EF4444" },
          { label: "Costo Mtto", value: `$${(stats.maintenanceCostMonth / 1000).toFixed(1)}k`, icon: DollarSign, color: "#8B5CF6" },
          { label: "Horas Op.", value: stats.hoursOperated.toLocaleString(), icon: Gauge, color: "#06B6D4" },
          { label: "Tripulación", value: stats.crewOnboard, icon: Users, color: "#F97316" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5"
          >
            <kpi.icon size={12} style={{ color: kpi.color }} />
            <p className="mt-1 text-sm font-bold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
            <p className="text-[9px] text-[var(--text-muted)]">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Offline Indicator */}
      <OfflineIndicator status={offlineStatus} onSync={syncNow} />

      {/* Tab Bar */}
      <div className="flex gap-0.5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all",
              activeTab === tab.id
                ? "bg-[#0EA5E9] text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {activeTab === "dashboard" && <DashboardTab kpis={kpis} workOrders={workOrders} equipment={equipment} zones={zones} events={events} readings={readings} />}
        {activeTab === "vessel-3d" && (
          <Vessel3D
            zones={zones}
            equipment={equipment}
            onToggleFullscreen={() => setFullscreen3D(true)}
          />
        )}
        {activeTab === "checklists" && <ChecklistTab checklists={checklists} />}
        {activeTab === "equipment" && <EquipmentTab equipment={equipment} zones={zones} />}
        {activeTab === "work-orders" && <WorkOrdersTab workOrders={workOrders} equipment={equipment} />}
        {activeTab === "crew" && <CrewTab crew={crew} />}
        {activeTab === "logistics" && <LogisticsTab equipment={equipment} />}
        {activeTab === "analytics" && <AnalyticsTab kpis={kpis} equipment={equipment} workOrders={workOrders} />}
        {activeTab === "ai" && <AITab equipment={equipment} workOrders={workOrders} kpis={kpis} />}
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// TAB: Dashboard
// ══════════════════════════════════════════════════

function DashboardTab({ kpis, workOrders, equipment, zones, events, readings }: {
  kpis: KPISnapshot[]; workOrders: WorkOrder[]; equipment: Equipment[]; zones: VesselZone[];
  events: ReturnType<typeof useFlotaDemo>["events"];
  readings: ReturnType<typeof useFlotaDemo>["readings"];
}) {
  const activeWOs = workOrders.filter((wo) => ["in_progress", "assigned"].includes(wo.status)).slice(0, 5);
  const zoneEquipmentCounts = zones.map((z) => ({
    ...z,
    count: equipment.filter((e) => e.zone_id === z.id).length,
    alerts: equipment.filter((e) => e.zone_id === z.id && e.status !== "operational").length,
  }));

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "up") return <ArrowUp size={8} className="text-red-400" />;
    if (trend === "down") return <ArrowDown size={8} className="text-green-400" />;
    return <Minus size={8} className="text-[var(--text-muted)]" />;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Live Readings — Realtime */}
      <div className="lg:col-span-2 rounded-xl border border-[#0EA5E9]/20 bg-[#030712] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0EA5E9]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9] animate-pulse" />
            Lecturas en Tiempo Real
          </h3>
          <span className="text-[8px] text-white/30">Actualización cada 3s</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {readings.slice(0, 8).map((r) => (
            <motion.div
              key={r.name}
              className="rounded-lg border border-white/5 bg-white/[0.03] p-2"
              animate={{ borderColor: r.trend !== "stable" ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)" }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-white/40 truncate">{r.name}</span>
                <TrendIcon trend={r.trend} />
              </div>
              <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: r.color }}>
                {r.value.toFixed(1)}
                <span className="text-[8px] font-normal text-white/30 ml-0.5">{r.unit}</span>
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Live Event Feed */}
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

      {/* Active Work Orders */}
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

      {/* Zones Overview */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Zonas del Buque
        </h3>
        <div className="space-y-1.5">
          {zoneEquipmentCounts.filter((z) => z.count > 0).map((z) => (
            <div key={z.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ZONE_TYPE_COLORS[z.zone_type] }} />
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

      {/* KPI Trend */}
      <div className="lg:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Tendencia KPIs — Últimos 6 Meses
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="text-center">
              <p className="text-[9px] text-[var(--text-muted)]">
                {new Date(kpi.snapshot_date).toLocaleDateString("es-EC", { month: "short", year: "2-digit" })}
              </p>
              <div className="mt-1 flex items-center justify-center gap-3">
                <div>
                  <p className="text-base font-bold text-[#10B981]">{kpi.availability_pct}%</p>
                  <p className="text-[8px] text-[var(--text-muted)]">Disp.</p>
                </div>
                <div>
                  <p className="text-base font-bold text-[#0EA5E9]">{kpi.mtbf_hours}h</p>
                  <p className="text-[8px] text-[var(--text-muted)]">MTBF</p>
                </div>
              </div>
              <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                ${(kpi.maintenance_cost / 1000).toFixed(1)}k
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// TAB: Equipment
// ══════════════════════════════════════════════════

function EquipmentTab({ equipment, zones }: { equipment: Equipment[]; zones: VesselZone[] }) {
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [critFilter, setCritFilter] = useState("all");

  const filtered = equipment.filter((e) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchZone = zoneFilter === "all" || e.zone_id === zoneFilter;
    const matchCrit = critFilter === "all" || e.criticality === critFilter;
    return matchSearch && matchZone && matchCrit;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar equipo..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] py-2 pl-3 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
          />
        </div>
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none">
          <option value="all">Todas las zonas</option>
          {zones.filter((z) => equipment.some((e) => e.zone_id === z.id)).map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
        <select value={critFilter} onChange={(e) => setCritFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none">
          <option value="all">Criticidad</option>
          <option value="critical">Crítico</option>
          <option value="high">Alto</option>
          <option value="medium">Medio</option>
          <option value="low">Bajo</option>
        </select>
        <span className="text-[10px] text-[var(--text-muted)]">{filtered.length} equipos</span>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Código</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Equipo</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] hidden md:table-cell">Zona</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] hidden lg:table-cell">Fabricante</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Criticidad</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((eq, i) => {
                const zone = zones.find((z) => z.id === eq.zone_id);
                return (
                  <motion.tr
                    key={eq.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)]/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-[#0EA5E9]">{eq.code}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[var(--text-primary)]">{eq.name}</p>
                      {eq.model && <p className="text-[10px] text-[var(--text-muted)]">{eq.manufacturer} {eq.model}</p>}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {zone && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                          style={{ backgroundColor: `${ZONE_TYPE_COLORS[zone.zone_type]}15`, color: ZONE_TYPE_COLORS[zone.zone_type] }}>
                          {zone.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-[var(--text-secondary)]">{eq.manufacturer || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: `${EQUIPMENT_CRITICALITY_COLORS[eq.criticality]}15`, color: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }} />
                        {EQUIPMENT_CRITICALITY_LABELS[eq.criticality]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: `${EQUIPMENT_STATUS_COLORS[eq.status]}15`, color: EQUIPMENT_STATUS_COLORS[eq.status] }}>
                        {EQUIPMENT_STATUS_LABELS[eq.status]}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// TAB: Work Orders
// ══════════════════════════════════════════════════

function WorkOrdersTab({ workOrders, equipment }: { workOrders: WorkOrder[]; equipment: Equipment[] }) {
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = workOrders.filter((wo) => statusFilter === "all" || wo.status === statusFilter);
  const statusCounts = {
    all: workOrders.length,
    planned: workOrders.filter((w) => w.status === "planned").length,
    in_progress: workOrders.filter((w) => w.status === "in_progress").length,
    completed: workOrders.filter((w) => w.status === "completed").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["all", "planned", "in_progress", "completed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full px-3 py-1 text-[10px] font-medium transition-all",
              statusFilter === s ? "bg-[#0EA5E9] text-white" : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {s === "all" ? "Todas" : WO_STATUS_LABELS[s]} ({statusCounts[s]})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((wo, i) => {
          const eq = equipment.find((e) => e.id === wo.equipment_id);
          return (
            <motion.div
              key={wo.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] font-bold text-[#0EA5E9]">{wo.wo_number}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                      style={{ backgroundColor: `${WO_PRIORITY_COLORS[wo.priority]}15`, color: WO_PRIORITY_COLORS[wo.priority] }}>
                      {WO_PRIORITY_LABELS[wo.priority]}
                    </span>
                    {eq && <span className="text-[10px] text-[var(--text-muted)]">· {eq.code} {eq.name}</span>}
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{wo.title}</p>
                  {wo.description && (
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)] line-clamp-2">{wo.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)]">
                    {wo.hours_estimated > 0 && <span>⏱ {wo.hours_estimated}h estimadas</span>}
                    {wo.cost_estimated > 0 && <span>💰 ${wo.cost_estimated.toLocaleString()}</span>}
                    {wo.planned_start && (
                      <span>📅 {new Date(wo.planned_start).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={{ backgroundColor: `${WO_STATUS_COLORS[wo.status]}15`, color: WO_STATUS_COLORS[wo.status] }}>
                  {WO_STATUS_LABELS[wo.status]}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// TAB: Crew
// ══════════════════════════════════════════════════

function CrewTab({ crew }: { crew: CrewMember[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {crew.map((member, i) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0EA5E9]" />
          <div className="flex items-center gap-3 pt-1">
            {member.employee?.avatar_url ? (
              <img src={member.employee.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[var(--border)]" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] text-xs font-bold">
                {(member.employee?.full_name || member.role).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{member.employee?.full_name || member.role}</p>
              <p className="text-[10px] text-[#0EA5E9] font-medium">{member.rank}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Certificaciones</p>
            <div className="flex flex-wrap gap-1">
              {(member.certifications || []).slice(0, 3).map((cert) => (
                <span key={cert} className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--text-secondary)]">
                  {cert}
                </span>
              ))}
            </div>
          </div>
          {member.boarding_date && (
            <p className="mt-2 text-[9px] text-[var(--text-muted)]">
              A bordo desde {new Date(member.boarding_date).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════
// TAB: Logistics (BOM)
// ══════════════════════════════════════════════════

function LogisticsTab({ equipment }: { equipment: Equipment[] }) {
  const allBOM = equipment.flatMap((eq) =>
    (eq.bom_items || []).map((item) => ({ ...item, equipmentCode: eq.code, equipmentName: eq.name }))
  );
  const criticalLow = allBOM.filter((b) => b.critical && b.quantity_onboard < b.quantity_required);

  return (
    <div className="space-y-4">
      {/* Critical Low Stock Alert */}
      {criticalLow.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-red-500">
            <AlertTriangle size={14} />
            Repuestos Críticos Bajo Stock ({criticalLow.length})
          </h3>
          <div className="space-y-1.5">
            {criticalLow.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] p-2.5">
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">{item.description}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{item.part_number} · {item.equipmentCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-500">{item.quantity_onboard}/{item.quantity_required}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">{item.lead_time_days}d lead time</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full BOM Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Part #</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Descripción</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] hidden md:table-cell">Equipo</th>
                <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-muted)]">Stock</th>
                <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-muted)] hidden sm:table-cell">Req.</th>
                <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-muted)] hidden lg:table-cell">Lead Time</th>
              </tr>
            </thead>
            <tbody>
              {allBOM.map((item) => {
                const isLow = item.quantity_onboard < item.quantity_required;
                return (
                  <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)]/20">
                    <td className="px-4 py-2 font-mono text-[#0EA5E9]">{item.part_number}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {item.critical && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        <span className="text-[var(--text-primary)]">{item.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[var(--text-muted)] hidden md:table-cell">{item.equipmentCode}</td>
                    <td className={cn("px-4 py-2 text-center font-bold", isLow ? "text-red-500" : "text-[var(--text-primary)]")}>
                      {item.quantity_onboard}
                    </td>
                    <td className="px-4 py-2 text-center text-[var(--text-muted)] hidden sm:table-cell">{item.quantity_required}</td>
                    <td className="px-4 py-2 text-center text-[var(--text-muted)] hidden lg:table-cell">{item.lead_time_days}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// TAB: Analytics
// ══════════════════════════════════════════════════

function AnalyticsTab({ kpis, equipment, workOrders }: { kpis: KPISnapshot[]; equipment: Equipment[]; workOrders: WorkOrder[] }) {
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
