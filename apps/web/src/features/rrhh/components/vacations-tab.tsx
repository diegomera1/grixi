"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Palmtree, Clock, CheckCircle2, XCircle, CalendarDays,
} from "lucide-react";
import type { LeaveRequest, Employee } from "../types";
import {
  LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS,
} from "../types";
import { updateLeaveRequestStatus } from "../actions/rrhh-actions";

type Props = { leaves: LeaveRequest[]; employees: Employee[] };

export function VacationsTab({ leaves, employees }: Props) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(
    () => leaves.filter((l) => statusFilter === "all" || l.status === statusFilter),
    [leaves, statusFilter]
  );

  const stats = useMemo(() => ({
    total: leaves.length,
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    rejected: leaves.filter((l) => l.status === "rejected").length,
    totalDays: leaves.filter((l) => l.status === "approved").reduce((s, l) => s + l.days_count, 0),
  }), [leaves]);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    setLoading(id);
    await updateLeaveRequestStatus(id, action);
    setLoading(null);
  };

  const getEmpName = (id: string) => employees.find((e) => e.id === id)?.full_name || "—";

  // Team absence timeline (gantt-style)
  const ganttData = useMemo(() => {
    const approved = leaves.filter((l) => l.status === "approved" || l.status === "pending");
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    return approved
      .filter((l) => {
        const ls = new Date(l.start_date);
        const le = new Date(l.end_date);
        return le >= start && ls <= end;
      })
      .map((l) => {
        const ls = new Date(l.start_date);
        const le = new Date(l.end_date);
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
        const startOffset = Math.max(0, Math.ceil((ls.getTime() - start.getTime()) / 86400000));
        const endOffset = Math.min(totalDays, Math.ceil((le.getTime() - start.getTime()) / 86400000));

        return {
          ...l,
          name: getEmpName(l.employee_id),
          startPct: (startOffset / totalDays) * 100,
          widthPct: ((endOffset - startOffset) / totalDays) * 100,
        };
      })
      .slice(0, 12);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, employees]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Solicitudes", value: stats.total, color: "#06B6D4", icon: CalendarDays },
          { label: "Pendientes", value: stats.pending, color: "#F59E0B", icon: Clock },
          { label: "Aprobadas", value: stats.approved, color: "#10B981", icon: CheckCircle2 },
          { label: "Días Aprobados", value: stats.totalDays, color: "#3B82F6", icon: Palmtree },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg p-1.5" style={{ backgroundColor: `${stat.color}15` }}>
                <stat.icon size={12} style={{ color: stat.color }} />
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Gantt Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Calendario de Ausencias</h3>
          {ganttData.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)] text-center py-8">No hay ausencias programadas</p>
          ) : (
            <div className="space-y-2">
              {ganttData.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="w-28 truncate text-[10px] font-medium text-[var(--text-secondary)]">{item.name}</span>
                  <div className="flex-1 h-6 relative rounded bg-[var(--bg-muted)]/50">
                    <motion.div
                      className="absolute top-0.5 bottom-0.5 rounded flex items-center justify-center overflow-hidden"
                      style={{
                        left: `${item.startPct}%`,
                        width: `${Math.max(item.widthPct, 3)}%`,
                        backgroundColor: LEAVE_TYPE_COLORS[item.leave_type],
                        opacity: item.status === "pending" ? 0.5 : 0.85,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(item.widthPct, 3)}%` }}
                      transition={{ delay: 0.5 + i * 0.05, duration: 0.4 }}
                    >
                      <span className="text-[7px] font-bold text-white truncate px-1">
                        {LEAVE_TYPE_LABELS[item.leave_type]}
                      </span>
                    </motion.div>
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] w-16 text-right">{item.days_count}d</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Requests List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Solicitudes</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-[10px]"
            >
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
            </select>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filtered.map((leave, i) => (
              <motion.div
                key={leave.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.04 }}
                className="rounded-lg border border-[var(--border)] p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                      {leave.employee?.full_name || getEmpName(leave.employee_id)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                        style={{ backgroundColor: `${LEAVE_TYPE_COLORS[leave.leave_type]}15`, color: LEAVE_TYPE_COLORS[leave.leave_type] }}
                      >
                        {LEAVE_TYPE_LABELS[leave.leave_type]}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                        style={{ backgroundColor: `${LEAVE_STATUS_COLORS[leave.status]}15`, color: LEAVE_STATUS_COLORS[leave.status] }}
                      >
                        {LEAVE_STATUS_LABELS[leave.status]}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{leave.days_count}d</span>
                </div>
                <p className="text-[9px] text-[var(--text-muted)]">
                  {new Date(leave.start_date).toLocaleDateString("es-EC")} → {new Date(leave.end_date).toLocaleDateString("es-EC")}
                </p>
                {leave.reason && (
                  <p className="text-[9px] text-[var(--text-secondary)] italic">{leave.reason}</p>
                )}
                {leave.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleAction(leave.id, "approved")}
                      disabled={loading === leave.id}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-500/10 py-1.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 size={11} /> Aprobar
                    </button>
                    <button
                      onClick={() => handleAction(leave.id, "rejected")}
                      disabled={loading === leave.id}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-500/10 py-1.5 text-[10px] font-medium text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={11} /> Rechazar
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
