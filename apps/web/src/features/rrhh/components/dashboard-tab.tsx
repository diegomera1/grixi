"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, TrendingDown, CalendarCheck, FileWarning,
  DollarSign, Clock, Cake, AlertTriangle, ChevronRight,
  TrendingUp, UserMinus,
} from "lucide-react";
import type { Employee, Department, RRHHKPIs, LeaveRequest } from "../types";

type Props = {
  employees: Employee[];
  departments: Department[];
  kpis: RRHHKPIs;
  leaves: LeaveRequest[];
};

const KPI_CARDS = [
  { key: "headcount" as const, label: "Headcount Activo", icon: Users, color: "#06B6D4", suffix: "" },
  { key: "rotation" as const, label: "Rotación 12M", icon: TrendingDown, color: "#F59E0B", suffix: "%" },
  { key: "attendanceToday" as const, label: "Asistencia Hoy", icon: CalendarCheck, color: "#10B981", suffix: "%" },
  { key: "contractsExpiring" as const, label: "Contratos x Vencer", icon: FileWarning, color: "#EF4444", suffix: "" },
  { key: "payrollCostMonth" as const, label: "Nómina del Mes", icon: DollarSign, color: "#8B5CF6", isCurrency: true },
];

export function DashboardTab({ employees, departments, kpis, leaves }: Props) {
  const departmentCounts = useMemo(() => {
    const counts: Record<string, { name: string; count: number; color: string }> = {};
    departments.forEach((d) => { counts[d.id] = { name: d.name, count: 0, color: d.color }; });
    employees.forEach((e) => {
      if (e.department_id && counts[e.department_id] && e.status === "active") {
        counts[e.department_id].count++;
      }
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [employees, departments]);

  const maxCount = Math.max(...departmentCounts.map((d) => d.count), 1);

  const birthdays = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    return employees
      .filter((e) => {
        if (!e.birth_date || e.status !== "active") return false;
        const bd = new Date(e.birth_date);
        return bd.getMonth() + 1 === currentMonth;
      })
      .map((e) => ({
        ...e,
        day: new Date(e.birth_date!).getDate(),
      }))
      .sort((a, b) => a.day - b.day);
  }, [employees]);

  const alerts = useMemo(() => {
    const items: { type: string; text: string; color: string; icon: typeof AlertTriangle }[] = [];
    
    // Contracts expiring
    if (kpis.contractsExpiring > 0) {
      items.push({
        type: "contract",
        text: `${kpis.contractsExpiring} contrato${kpis.contractsExpiring > 1 ? "s" : ""} vence${kpis.contractsExpiring > 1 ? "n" : ""} en los próximos 30 días`,
        color: "#EF4444",
        icon: FileWarning,
      });
    }

    // Pending leaves
    const pendingLeaves = leaves.filter((l) => l.status === "pending");
    if (pendingLeaves.length > 0) {
      items.push({
        type: "leave",
        text: `${pendingLeaves.length} solicitud${pendingLeaves.length > 1 ? "es" : ""} de permiso pendiente${pendingLeaves.length > 1 ? "s" : ""}`,
        color: "#F59E0B",
        icon: Clock,
      });
    }

    // Low attendance
    if (kpis.attendanceToday < 85) {
      items.push({
        type: "attendance",
        text: `Asistencia de hoy por debajo del umbral (${kpis.attendanceToday}%)`,
        color: "#EF4444",
        icon: UserMinus,
      });
    }

    return items;
  }, [kpis, leaves]);

  const seniorityDistribution = useMemo(() => {
    const brackets = [
      { label: "< 1 año", count: 0, color: "#06B6D4" },
      { label: "1-3 años", count: 0, color: "#3B82F6" },
      { label: "3-5 años", count: 0, color: "#8B5CF6" },
      { label: "5-10 años", count: 0, color: "#F59E0B" },
      { label: "10+ años", count: 0, color: "#10B981" },
    ];
    const now = new Date();
    employees.filter((e) => e.status === "active").forEach((e) => {
      const years = (now.getTime() - new Date(e.hire_date).getTime()) / (365.25 * 86400000);
      if (years < 1) brackets[0].count++;
      else if (years < 3) brackets[1].count++;
      else if (years < 5) brackets[2].count++;
      else if (years < 10) brackets[3].count++;
      else brackets[4].count++;
    });
    return brackets;
  }, [employees]);

  const seniorityMax = Math.max(...seniorityDistribution.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_CARDS.map((card, i) => {
          const value = kpis[card.key];
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-all hover:shadow-lg"
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: `radial-gradient(circle at 50% 0%, ${card.color}08, transparent 70%)` }}
              />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg p-2" style={{ backgroundColor: `${card.color}15` }}>
                    <card.icon size={16} style={{ color: card.color }} />
                  </div>
                  <TrendingUp size={12} className="text-emerald-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                  {(card as { isCurrency?: boolean }).isCurrency
                    ? `$${(value / 1000).toFixed(0)}K`
                    : `${value}${card.suffix}`}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">{card.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Headcount by Department */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Headcount por Departamento</h3>
          <div className="space-y-2.5">
            {departmentCounts.map((dept, i) => (
              <div key={dept.name} className="flex items-center gap-3">
                <span className="w-28 truncate text-[11px] font-medium text-[var(--text-secondary)]">{dept.name}</span>
                <div className="flex-1 h-5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <motion.div
                    className="h-full rounded-full flex items-center justify-end pr-2"
                    style={{ backgroundColor: dept.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(dept.count / maxCount) * 100}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                  >
                    <span className="text-[9px] font-bold text-white">{dept.count}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Seniority Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Antigüedad del Personal</h3>
          <div className="flex items-end gap-3 h-36">
            {seniorityDistribution.map((bracket, i) => (
              <div key={bracket.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-[var(--text-primary)]">{bracket.count}</span>
                <motion.div
                  className="w-full rounded-t-lg"
                  style={{ backgroundColor: bracket.color }}
                  initial={{ height: 0 }}
                  animate={{ height: `${(bracket.count / seniorityMax) * 100}%` }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                />
                <span className="text-[8px] text-[var(--text-muted)] text-center leading-tight">{bracket.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Clock size={12} className="text-[var(--text-muted)]" />
            <span className="text-[10px] text-[var(--text-muted)]">
              Promedio: <strong className="text-[var(--text-primary)]">{kpis.avgSeniority} años</strong>
            </span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Birthdays */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Cake size={14} className="text-pink-500" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Cumpleaños del Mes</h3>
          </div>
          {birthdays.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)] text-center py-4">No hay cumpleaños este mes</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {birthdays.map((emp) => (
                <motion.div
                  key={emp.id}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--bg-muted)]"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-400 text-[10px] font-bold text-white shrink-0">
                    {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{emp.full_name}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{emp.position}</p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-pink-500">{emp.day} Mar</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Alertas</h3>
          </div>
          {alerts.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)] text-center py-4">Sin alertas pendientes ✅</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <motion.div
                  key={alert.type}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="flex items-start gap-3 rounded-lg border p-3"
                  style={{ borderColor: `${alert.color}30`, backgroundColor: `${alert.color}05` }}
                >
                  <alert.icon size={14} style={{ color: alert.color }} className="mt-0.5 shrink-0" />
                  <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">{alert.text}</p>
                  <ChevronRight size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Resumen Rápido</h3>
          <div className="space-y-3">
            {[
              { label: "Solicitudes Pendientes", value: kpis.pendingLeaves, color: "#F59E0B" },
              { label: "Costo Horas Extra", value: `$${(kpis.overtimeCost / 1000).toFixed(1)}K`, color: "#EF4444" },
              { label: "Antigüedad Promedio", value: `${kpis.avgSeniority} años`, color: "#06B6D4" },
              { label: "Empleados Activos", value: kpis.headcount, color: "#10B981" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stat.color }} />
                  <span className="text-[11px] text-[var(--text-secondary)]">{stat.label}</span>
                </div>
                <motion.span
                  className="text-sm font-bold text-[var(--text-primary)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  {stat.value}
                </motion.span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
