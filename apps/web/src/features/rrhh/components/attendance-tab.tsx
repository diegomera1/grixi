"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AttendanceRecord, Employee, Department } from "../types";
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "../types";

type Props = {
  attendance: AttendanceRecord[];
  employees: Employee[];
  departments: Department[];
};

export function AttendanceTab({ attendance, employees, departments }: Props) {
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const year = parseInt(selectedMonth.split("-")[0]);
  const month = parseInt(selectedMonth.split("-")[1]);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthLabel = new Date(year, month - 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.status === "active" && (selectedDept === "all" || e.department_id === selectedDept)),
    [employees, selectedDept]
  );

  // Build attendance map: date -> status counts
  const dailySummary = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const empIds = new Set(filteredEmployees.map((e) => e.id));

    attendance.forEach((a) => {
      if (!empIds.has(a.employee_id)) return;
      const d = a.date;
      if (!d.startsWith(`${year}-${String(month).padStart(2, "0")}`)) return;
      if (!map[d]) map[d] = {};
      map[d][a.status] = (map[d][a.status] || 0) + 1;
    });
    return map;
  }, [attendance, filteredEmployees, year, month]);

  const getCellColor = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0 || dow === 6) return "var(--bg-muted)";

    const summary = dailySummary[dateStr];
    if (!summary) return "var(--bg-muted)";

    const present = (summary.present || 0) + (summary.late || 0);
    const total = Object.values(summary).reduce((s, v) => s + v, 0);
    const pct = total > 0 ? present / total : 0;

    if (pct >= 0.9) return "#10B981"; // Green
    if (pct >= 0.75) return "#84CC16"; // Lime
    if (pct >= 0.6) return "#F59E0B"; // Amber
    return "#EF4444"; // Red
  };

  const getCellOpacity = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const now = new Date();
    const cellDate = new Date(year, month - 1, day);
    if (cellDate > now) return 0.2;
    const dow = cellDate.getDay();
    if (dow === 0 || dow === 6) return 0.15;
    return 0.85;
  };

  const statsForMonth = useMemo(() => {
    let present = 0, late = 0, absent = 0, total = 0;
    Object.values(dailySummary).forEach((day) => {
      present += day.present || 0;
      late += day.late || 0;
      absent += day.absent || 0;
      total += Object.values(day).reduce((s, v) => s + v, 0);
    });
    return {
      attendancePct: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      punctualityPct: total > 0 ? Math.round((present / total) * 100) : 0,
      absentPct: total > 0 ? Math.round((absent / total) * 100) : 0,
      present,
      late,
      absent,
    };
  }, [dailySummary]);

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Asistencia", value: `${statsForMonth.attendancePct}%`, color: "#10B981" },
          { label: "Puntualidad", value: `${statsForMonth.punctualityPct}%`, color: "#3B82F6" },
          { label: "Ausentismo", value: `${statsForMonth.absentPct}%`, color: "#EF4444" },
          { label: "Tardanzas", value: statsForMonth.late, color: "#F59E0B" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stat.color }} />
              <span className="text-[10px] text-[var(--text-muted)]">{stat.label}</span>
            </div>
            <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-[var(--bg-muted)] text-[var(--text-muted)]">
              <ChevronLeft size={16} />
            </button>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] capitalize">{monthLabel}</h3>
            <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-[var(--bg-muted)] text-[var(--text-muted)]">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Filter */}
          <div className="mb-4">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
            >
              <option value="all">Todos los departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayLabels.map((d) => (
              <div key={d} className="text-center text-[9px] font-semibold text-[var(--text-muted)] py-1">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const summary = dailySummary[dateStr] || {};
              const total = Object.values(summary).reduce((s, v) => s + v, 0);

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.01 }}
                  className="group relative aspect-square rounded-lg flex flex-col items-center justify-center cursor-default transition-all hover:ring-2 hover:ring-[#06B6D4]/50"
                  style={{
                    backgroundColor: getCellColor(day),
                    opacity: getCellOpacity(day),
                  }}
                >
                  <span className="text-[10px] font-bold text-white mix-blend-difference">{day}</span>

                  {/* Tooltip */}
                  {total > 0 && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-xl min-w-[120px]">
                        <p className="text-[9px] font-semibold text-[var(--text-primary)] mb-1">{dateStr}</p>
                        {Object.entries(summary).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1">
                              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ATTENDANCE_STATUS_COLORS[status as keyof typeof ATTENDANCE_STATUS_COLORS] }} />
                              <span className="text-[8px] text-[var(--text-muted)]">
                                {ATTENDANCE_STATUS_LABELS[status as keyof typeof ATTENDANCE_STATUS_LABELS]}
                              </span>
                            </div>
                            <span className="text-[8px] font-mono font-bold text-[var(--text-primary)]">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-[var(--border)]">
            {[
              { label: "Excelente (90%+)", color: "#10B981" },
              { label: "Buena (75-90%)", color: "#84CC16" },
              { label: "Regular (60-75%)", color: "#F59E0B" },
              { label: "Baja (<60%)", color: "#EF4444" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: item.color }} />
                <span className="text-[8px] text-[var(--text-muted)]">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Department Attendance Ranking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Ranking por Departamento</h3>
          <div className="space-y-3">
            {departments
              .map((dept) => {
                const deptEmps = employees.filter((e) => e.department_id === dept.id && e.status === "active");
                const deptEmpIds = new Set(deptEmps.map((e) => e.id));
                const deptAtt = attendance.filter(
                  (a) => deptEmpIds.has(a.employee_id) && a.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)
                );
                const present = deptAtt.filter((a) => a.status === "present" || a.status === "late").length;
                const total = deptAtt.length;
                const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                return { ...dept, pct };
              })
              .sort((a, b) => b.pct - a.pct)
              .map((dept, i) => (
                <div key={dept.id} className="flex items-center gap-3">
                  <span className="w-4 text-[10px] font-bold text-[var(--text-muted)]">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">{dept.name}</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: dept.pct >= 85 ? "#10B981" : dept.pct >= 70 ? "#F59E0B" : "#EF4444" }}>
                        {dept.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: dept.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${dept.pct}%` }}
                        transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
