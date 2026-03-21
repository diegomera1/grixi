"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Ship, Gauge, Wrench, ClipboardCheck, ClipboardList, Users, Package,
  BarChart3, Activity, AlertTriangle, Cpu, Link2,
  DollarSign, Clock, TrendingUp, Anchor, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useFlotaDemo } from "../hooks/use-flota-demo";
import { useOfflineSync } from "../hooks/use-offline-sync";
import { useMaritimeData } from "../hooks/use-maritime-data";
import { DashboardTab } from "./dashboard-tab";
import { EquipmentTab } from "./equipment-tab";
import { WorkOrdersTab } from "./work-orders-tab";
import { CrewTab } from "./crew-tab";
import { LogisticsTab } from "./logistics-tab";
import { AnalyticsTab } from "./analytics-tab";
import { ChecklistTab } from "./checklist-tab";
import { MaintenancePlansTab } from "./maintenance-plans-tab";
import { AITab } from "./ai-tab";
import { LogbookTab } from "./logbook-tab";
import { AlertsTab } from "./alerts-tab";
import { CertificatesTab } from "./certificates-tab";
import { FuelTab } from "./fuel-tab";
import { CrossModuleTab } from "./cross-module-tab";
import { OfflineIndicator } from "./offline-indicator";
import { VesselProfile } from "./vessel-profile";
import type {
  Vessel, VesselZone, Equipment, WorkOrder,
  Checklist, CrewMember, KPISnapshot, FlotaKPIs,
  LogbookEntry, FleetAlert, FleetCertificate, FuelLog,
  MaintenancePlan,
} from "../types";
import { VESSEL_STATUS_LABELS } from "../types";

// ── Tabs ────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "vessel-3d", label: "Buque", icon: Ship },
  { id: "equipment", label: "Equipos", icon: Wrench },
  { id: "work-orders", label: "Órdenes", icon: ClipboardCheck },
  { id: "plans", label: "Planes Mtto", icon: CalendarClock },
  { id: "checklists", label: "Checklists", icon: ClipboardList },
  { id: "logbook", label: "Bitácora", icon: ClipboardList },
  { id: "alerts", label: "Alertas", icon: AlertTriangle },
  { id: "certificates", label: "Certificados", icon: ClipboardCheck },
  { id: "fuel", label: "Combustible", icon: Activity },
  { id: "crew", label: "Tripulación", icon: Users },
  { id: "logistics", label: "Logística", icon: Package },
  { id: "analytics", label: "Analítica", icon: BarChart3 },
  { id: "cross-module", label: "Cross-Módulo", icon: Link2 },
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
  maintenancePlans: MaintenancePlan[];
  logbook: LogbookEntry[];
  alerts: FleetAlert[];
  certificates: FleetCertificate[];
  fuelLogs: FuelLog[];
};

// ── Main Content ────────────────────────────────

export function FlotaContent({ data }: { data: FlotaData }) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [fullscreenProfile, setFullscreenProfile] = useState(false);
  const { vessel, zones, equipment, workOrders, checklists, crew, kpis, stats, maintenancePlans, logbook, alerts, certificates, fuelLogs } = data;
  const { events, readings } = useFlotaDemo();
  const { status: offlineStatus, syncNow, cacheModuleData } = useOfflineSync();
  const maritime = useMaritimeData();

  // Auto-cache fleet data to IndexedDB for offline access
  useEffect(() => {
    if (vessel?.id) {
      cacheModuleData("fleet_vessel", vessel);
      cacheModuleData("fleet_equipment", equipment);
      cacheModuleData("fleet_work_orders", workOrders);
      cacheModuleData("fleet_kpis", kpis);
      cacheModuleData("fleet_logbook", logbook);
      cacheModuleData("fleet_alerts", alerts);
      cacheModuleData("fleet_certificates", certificates);
      cacheModuleData("fleet_fuel_logs", fuelLogs);
      cacheModuleData("fleet_crew", crew);
      cacheModuleData("fleet_zones", zones);
    }
  }, [vessel, cacheModuleData, equipment, workOrders, kpis, logbook, alerts, certificates, fuelLogs, crew, zones]);

  // Fullscreen vessel profile overlay
  if (fullscreenProfile) {
    return (
      <VesselProfile
        zones={zones}
        equipment={equipment}
        weather={maritime.weather}
        fullscreenMode
        onToggleFullscreen={() => setFullscreenProfile(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header + Tabs — matching Finanzas/Compras pattern */}
      <div className="mb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#0EA5E9]/10">
              <Ship size={18} className="text-[#0EA5E9] sm:hidden" />
              <Ship size={20} className="text-[#0EA5E9] hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">{vessel.name}</h2>
              <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] truncate">
                {vessel.imo_number} · {VESSEL_STATUS_LABELS[vessel.status]}
                <span className="hidden sm:inline"> · {vessel.class_society}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[#0EA5E9]/30 bg-[#0EA5E9]/5">
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0EA5E9] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-[#0EA5E9]" />
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-[#0EA5E9]">
                {VESSEL_STATUS_LABELS[vessel.status]}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-[var(--text-muted)]">
              <Anchor size={10} />
              <span className="truncate">{vessel.port_of_registry} · {vessel.flag}</span>
            </div>
          </div>
        </div>
        {/* Tab Navigation — same underline pattern as Finanzas/Compras */}
        <div className="flex items-center overflow-x-auto border-b border-[var(--border)] scrollbar-hide -mx-4 px-4 sm:-mx-2 sm:px-2 md:mx-0 md:px-0 sm:gap-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 text-xs font-medium transition-all relative shrink-0",
                "sm:justify-start sm:px-3",
                "px-2.5 min-w-[40px]",
                activeTab === tab.id
                  ? "text-[#0EA5E9]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <tab.icon size={14} className="shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="flota-tab-indicator"
                  className="absolute bottom-0 left-1.5 right-1.5 sm:left-2 sm:right-2 h-0.5 bg-[#0EA5E9] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Offline Indicator */}
      <OfflineIndicator status={offlineStatus} onSync={syncNow} />

      {/* KPI Hero Bar */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-8">
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
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 sm:p-2.5"
          >
            <kpi.icon size={11} className="sm:hidden" style={{ color: kpi.color }} />
            <kpi.icon size={12} className="hidden sm:block" style={{ color: kpi.color }} />
            <p className="mt-0.5 sm:mt-1 text-[13px] sm:text-sm font-bold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
            <p className="text-[8px] sm:text-[9px] text-[var(--text-muted)] truncate">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {activeTab === "dashboard" && <DashboardTab kpis={kpis} workOrders={workOrders} equipment={equipment} zones={zones} events={events} readings={readings} logbook={logbook} alerts={alerts} certificates={certificates} fuelLogs={fuelLogs} stats={stats} />}
        {activeTab === "vessel-3d" && (
          <VesselProfile
            zones={zones}
            equipment={equipment}
            weather={maritime.weather}
            onToggleFullscreen={() => setFullscreenProfile(true)}
          />
        )}
        {activeTab === "equipment" && <EquipmentTab equipment={equipment} zones={zones} workOrders={workOrders} />}
        {activeTab === "work-orders" && <WorkOrdersTab vesselId={vessel.id} workOrders={workOrders} equipment={equipment} crew={crew} />}
        {activeTab === "plans" && <MaintenancePlansTab plans={maintenancePlans} vesselId={vessel.id} />}
        {activeTab === "checklists" && <ChecklistTab checklists={checklists} />}
        {activeTab === "logbook" && <LogbookTab logbook={logbook} />}
        {activeTab === "alerts" && <AlertsTab alerts={alerts} />}
        {activeTab === "certificates" && <CertificatesTab certificates={certificates} />}
        {activeTab === "fuel" && <FuelTab fuelLogs={fuelLogs} />}
        {activeTab === "crew" && <CrewTab crew={crew} />}
        {activeTab === "logistics" && <LogisticsTab equipment={equipment} />}
        {activeTab === "analytics" && <AnalyticsTab kpis={kpis} equipment={equipment} workOrders={workOrders} />}
        {activeTab === "cross-module" && <CrossModuleTab equipment={equipment} workOrders={workOrders} alerts={alerts} certificates={certificates} fuelLogs={fuelLogs} crew={crew} />}
        {activeTab === "ai" && <AITab equipment={equipment} workOrders={workOrders} kpis={kpis} alerts={alerts} certificates={certificates} fuelLogs={fuelLogs} />}
      </motion.div>
    </div>
  );
}
