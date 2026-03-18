"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Ship, Gauge, Wrench, ClipboardCheck, ClipboardList, Users, Package,
  BarChart3, Waves, Activity, AlertTriangle, Cpu,
  DollarSign, Clock, TrendingUp, Anchor,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useFlotaDemo } from "../hooks/use-flota-demo";
import { useOfflineSync } from "../hooks/use-offline-sync";
import { DashboardTab } from "./dashboard-tab";
import { EquipmentTab } from "./equipment-tab";
import { WorkOrdersTab } from "./work-orders-tab";
import { CrewTab } from "./crew-tab";
import { LogisticsTab } from "./logistics-tab";
import { AnalyticsTab } from "./analytics-tab";
import { ChecklistTab } from "./checklist-tab";
import { AITab } from "./ai-tab";
import { OfflineIndicator } from "./offline-indicator";
import type {
  Vessel, VesselZone, Equipment, WorkOrder,
  Checklist, CrewMember, KPISnapshot, FlotaKPIs,
} from "../types";
import { VESSEL_STATUS_LABELS, VESSEL_STATUS_COLORS } from "../types";

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
      <div className="flex gap-0.5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-0.5 scrollbar-hide">
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
        {activeTab === "equipment" && <EquipmentTab equipment={equipment} zones={zones} workOrders={workOrders} />}
        {activeTab === "work-orders" && <WorkOrdersTab workOrders={workOrders} equipment={equipment} />}
        {activeTab === "checklists" && <ChecklistTab checklists={checklists} />}
        {activeTab === "crew" && <CrewTab crew={crew} />}
        {activeTab === "logistics" && <LogisticsTab equipment={equipment} />}
        {activeTab === "analytics" && <AnalyticsTab kpis={kpis} equipment={equipment} workOrders={workOrders} />}
        {activeTab === "ai" && <AITab equipment={equipment} workOrders={workOrders} kpis={kpis} />}
      </motion.div>
    </div>
  );
}
