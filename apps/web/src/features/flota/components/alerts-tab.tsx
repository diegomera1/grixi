"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell, CheckCircle2, Clock, AlertTriangle,
  Shield, Wrench, CloudRain, FileWarning,
  Eye, X,
} from "lucide-react";
import type { FleetAlert } from "../types";

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  emergency: { color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", icon: <AlertTriangle size={14} className="text-red-500" /> },
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", icon: <AlertTriangle size={14} className="text-red-400" /> },
  warning: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", icon: <FileWarning size={14} className="text-amber-500" /> },
  info: { color: "#0EA5E9", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.2)", icon: <Eye size={14} className="text-sky-500" /> },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  equipment: <Wrench size={12} />,
  weather: <CloudRain size={12} />,
  maintenance: <Clock size={12} />,
  safety: <Shield size={12} />,
  regulatory: <FileWarning size={12} />,
};

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

type AlertsTabProps = {
  alerts: FleetAlert[];
};

export function AlertsTab({ alerts }: AlertsTabProps) {
  const [view, setView] = useState<"active" | "resolved">("active");

  const active = alerts.filter((a) => !a.resolved_at);
  const resolved = alerts.filter((a) => !!a.resolved_at);
  const displayed = view === "active" ? active : resolved;

  const countBySeverity = (sev: string) => active.filter((a) => a.severity === sev).length;

  return (
    <div className="space-y-4">
      {/* Header + Summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <Bell size={16} className="text-red-500" />
          Centro de Alertas
          {active.length > 0 && (
            <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-500 animate-pulse">
              {active.length} activas
            </span>
          )}
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {(["emergency", "critical", "warning", "info"] as const).map((sev) => {
          const config = SEVERITY_CONFIG[sev];
          const count = countBySeverity(sev);
          return (
            <div key={sev} className="rounded-xl border p-3 text-center" style={{ borderColor: config.border, backgroundColor: config.bg }}>
              <p className="text-2xl font-bold tabular-nums" style={{ color: config.color }}>{count}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: config.color }}>{sev}</p>
            </div>
          );
        })}
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-0.5 w-fit">
        <button
          onClick={() => setView("active")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${view === "active" ? "bg-red-500 text-white shadow-sm" : "text-[var(--text-muted)]"}`}
        >
          Activas ({active.length})
        </button>
        <button
          onClick={() => setView("resolved")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${view === "resolved" ? "bg-emerald-500 text-white shadow-sm" : "text-[var(--text-muted)]"}`}
        >
          Resueltas ({resolved.length})
        </button>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {displayed.map((alert, i) => {
          const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border p-4"
              style={{ borderColor: config.border, backgroundColor: config.bg }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="shrink-0 mt-0.5">{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
                        {alert.severity}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                        {TYPE_ICONS[alert.alert_type]}
                        {alert.alert_type}
                      </span>
                      <span className="text-[8px] text-[var(--text-muted)]">· {alert.source}</span>
                    </div>
                    <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">{alert.title}</h4>
                    {alert.message && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 line-clamp-2">{alert.message}</p>
                    )}
                    {alert.equipment_name && (
                      <p className="text-[9px] text-[var(--text-muted)] mt-1">🔧 Equipo: {alert.equipment_name}</p>
                    )}
                    {alert.resolved_at && alert.resolution_notes && (
                      <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                        <p className="text-[9px] font-medium text-emerald-600">✅ {alert.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[9px] text-[var(--text-muted)] shrink-0">{timeAgo(alert.created_at)}</span>
              </div>
            </motion.div>
          );
        })}
        {displayed.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <CheckCircle2 size={32} className="text-emerald-500 mb-3" />
            <p className="text-sm text-[var(--text-muted)]">{view === "active" ? "Sin alertas activas" : "Sin alertas resueltas"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
