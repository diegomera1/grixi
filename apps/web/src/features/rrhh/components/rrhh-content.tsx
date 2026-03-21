"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Network, CalendarClock, Wallet,
  Palmtree, Star,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  Employee, Department, AttendanceRecord, PayrollRecord,
  LeaveRequest, PerformanceReview, RRHHKPIs,
} from "../types";
import { useRRHHRealtime } from "../hooks/use-rrhh-realtime";
import { useRRHHDemo } from "../hooks/use-rrhh-demo";
import { DashboardTab } from "./dashboard-tab";
import { EmployeesTab } from "./employees-tab";
import { OrgchartTab } from "./orgchart-tab";
import { AttendanceTab } from "./attendance-tab";
import { PayrollTab } from "./payroll-tab";
import { VacationsTab } from "./vacations-tab";
import { EvaluationsTab } from "./evaluations-tab";
import { LiveActivityFeed } from "./live-activity-feed";

type Tab = "dashboard" | "empleados" | "organigrama" | "asistencia" | "nomina" | "vacaciones" | "evaluaciones";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "empleados", label: "Empleados", icon: Users },
  { id: "organigrama", label: "Organigrama", icon: Network },
  { id: "asistencia", label: "Asistencia", icon: CalendarClock },
  { id: "nomina", label: "Nómina", icon: Wallet },
  { id: "vacaciones", label: "Vacaciones", icon: Palmtree },
  { id: "evaluaciones", label: "Evaluaciones", icon: Star },
];

type Props = {
  initialEmployees: Employee[];
  initialDepartments: Department[];
  initialAttendance: AttendanceRecord[];
  initialPayroll: PayrollRecord[];
  initialLeaves: LeaveRequest[];
  initialReviews: PerformanceReview[];
  initialKPIs: RRHHKPIs;
};

export function RRHHContent({
  initialEmployees, initialDepartments, initialAttendance,
  initialPayroll, initialLeaves, initialReviews, initialKPIs,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [leaves, setLeaves] = useState(initialLeaves);
  const [attendance, setAttendance] = useState(initialAttendance);

  // Demo simulation — generates live HR events
  const { events, isRunning } = useRRHHDemo(true);

  // Realtime subscriptions
  useRRHHRealtime({
    onLeaveChange: useCallback((leave: LeaveRequest) => {
      setLeaves((prev) => {
        const idx = prev.findIndex((l) => l.id === leave.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...leave };
          return next;
        }
        return [leave, ...prev];
      });
    }, []),
    onAttendanceChange: useCallback((record: AttendanceRecord) => {
      setAttendance((prev) => {
        const idx = prev.findIndex((a) => a.id === record.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...record };
          return next;
        }
        return [record, ...prev];
      });
    }, []),
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* Header + Tabs */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Recursos Humanos
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Gestión del talento, nómina y bienestar — SAP HCM
          </p>
        </div>
        <div className="flex items-center overflow-x-auto border-b border-[var(--border)] scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0 sm:gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all relative shrink-0",
                "sm:justify-start sm:px-3",
                "px-2",
                activeTab === tab.id
                  ? "text-[#06B6D4]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="rrhh-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#06B6D4] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live Activity Feed */}
      <LiveActivityFeed events={events} isRunning={isRunning} />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "dashboard" && (
            <DashboardTab
              employees={initialEmployees}
              departments={initialDepartments}
              kpis={initialKPIs}
              leaves={leaves}
            />
          )}
          {activeTab === "empleados" && (
            <EmployeesTab
              employees={initialEmployees}
              departments={initialDepartments}
            />
          )}
          {activeTab === "organigrama" && (
            <OrgchartTab
              employees={initialEmployees}
              departments={initialDepartments}
            />
          )}
          {activeTab === "asistencia" && (
            <AttendanceTab
              attendance={attendance}
              employees={initialEmployees}
              departments={initialDepartments}
            />
          )}
          {activeTab === "nomina" && (
            <PayrollTab
              payroll={initialPayroll}
              employees={initialEmployees}
              departments={initialDepartments}
            />
          )}
          {activeTab === "vacaciones" && (
            <VacationsTab
              leaves={leaves}
              employees={initialEmployees}
            />
          )}
          {activeTab === "evaluaciones" && (
            <EvaluationsTab
              reviews={initialReviews}
              employees={initialEmployees}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
