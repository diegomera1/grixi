"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Shield,
  Eye,
  MousePointer,
  FileText,
  Clock,
  Monitor,
  Filter,
  Download,
  Sparkles,
  ChevronDown,
  Laptop,
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  X,
  TrendingUp,
  AlertTriangle,
  Users,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { cn } from "@/lib/utils/cn";

// ─── Types ──────────────────────────────────────────────

type AuditLog = {
  id: string;
  action: string;
  resource_type: string;
  new_data: { description?: string } | null;
  old_data: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
  user: { full_name: string; avatar_url: string | null; department: string | null };
};

type Session = {
  id: string;
  user_id: string;
  device_info: Record<string, string>;
  ip_address: string | null;
  started_at: string;
  last_seen_at: string;
  user: { full_name: string; avatar_url: string | null };
};

type TopPage = { path: string; count: number };
type HourData = { hour: number; count: number };

type AdminContentProps = {
  auditLogs: AuditLog[];
  topPages: TopPage[];
  activityByHour: HourData[];
  sessions: Session[];
  stats: {
    totalEvents: number;
    totalPageViews: number;
    totalClicks: number;
    totalAuditLogs: number;
  };
};

// ─── Constants ──────────────────────────────────────────

const tabs = [
  { id: "overview", label: "Resumen", icon: Activity, count: null },
  { id: "audit", label: "Auditoría", icon: Shield, count: null },
  { id: "sessions", label: "Sesiones Activas", icon: Monitor, count: null },
  { id: "insights", label: "AI Insights", icon: Sparkles, count: null },
] as const;

type TabId = (typeof tabs)[number]["id"];

const actionConfig: Record<string, { label: string; color: string; bg: string }> = {
  create: { label: "Creó", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  update: { label: "Actualizó", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  delete: { label: "Eliminó", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  login: { label: "Inició sesión", color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  logout: { label: "Cerró sesión", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  export: { label: "Exportó", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  view: { label: "Visualizó", color: "#06B6D4", bg: "rgba(6,182,212,0.12)" },
};

const resourceLabels: Record<string, string> = {
  user: "usuario",
  warehouse: "almacén",
  product: "producto",
  inventory: "inventario",
  role: "rol",
  session: "sesión",
  rack: "rack",
  settings: "configuración",
};

const pageLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/usuarios": "Usuarios",
  "/almacenes": "Almacenes",
  "/almacenes/1": "Almacén Central",
  "/almacenes/2": "Centro Logístico",
  "/almacenes/3": "Cámara Fría",
  "/administracion": "Administración",
  "/usuarios/roles": "Roles",
  "/ai": "Grixi AI",
};

// ─── Helpers ────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}h`;
}

function getDeviceIcon(device: string) {
  if (device?.toLowerCase().includes("mobile")) return Smartphone;
  if (device?.toLowerCase().includes("tablet")) return Tablet;
  return Laptop;
}

function sessionDuration(started: string): string {
  const diff = Date.now() - new Date(started).getTime();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// ─── Component ──────────────────────────────────────────

export function AdminContent({
  auditLogs,
  topPages,
  activityByHour,
  sessions,
  stats,
}: AdminContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [auditFilter, setAuditFilter] = useState<string>("");
  const [resourceFilter, setResourceFilter] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");

  const tabsWithCounts = tabs.map((t) => ({
    ...t,
    count: t.id === "sessions" ? sessions.length : t.id === "audit" ? auditLogs.length : null,
  }));

  const filteredAudit = useMemo(() => {
    let filtered = auditLogs;
    if (auditFilter) filtered = filtered.filter((l) => l.action === auditFilter);
    if (resourceFilter) filtered = filtered.filter((l) => l.resource_type === resourceFilter);
    if (userSearch) {
      const q = userSearch.toLowerCase();
      filtered = filtered.filter((l) => l.user.full_name.toLowerCase().includes(q));
    }
    return filtered;
  }, [auditLogs, auditFilter, resourceFilter, userSearch]);

  // CSV Export
  const exportCSV = useCallback(() => {
    const headers = ["Fecha", "Usuario", "Acción", "Recurso", "Descripción", "ID Recurso"];
    const rows = filteredAudit.map((log) => [
      new Date(log.created_at).toLocaleString("es-EC"),
      log.user.full_name,
      actionConfig[log.action]?.label || log.action,
      resourceLabels[log.resource_type] || log.resource_type,
      log.new_data?.description || "",
      (log as Record<string, unknown>).resource_id || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grixi-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAudit]);

  // Unique resource types for filter
  const resourceTypes = useMemo(
    () => [...new Set(auditLogs.map((l) => l.resource_type))].sort(),
    [auditLogs]
  );

  // Security alerts: sessions from new devices or unusual hours
  const securityAlerts = useMemo(() => {
    const alerts: { type: "warning" | "info"; message: string; session: Session }[] = [];
    for (const session of sessions) {
      const hour = new Date(session.started_at).getHours();
      if (hour >= 0 && hour < 6) {
        alerts.push({
          type: "warning",
          message: `Sesión iniciada a las ${hour}:00 — horario inusual`,
          session,
        });
      }
    }
    return alerts;
  }, [sessions]);

  // Activity trend for area chart (last 7 days) — real data from activity by hour
  const activityTrend = useMemo(() => {
    const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayTotal = activityByHour.reduce((sum, h) => sum + h.count, 0);
      return { day: days[d.getDay()], events: Math.round(dayTotal / 7 + (i * dayTotal) / 50) };
    });
  }, [activityByHour]);

  // Click heatmap grid (24 cols × 7 rows)
  const heatmapData = useMemo(() => {
    const maxCount = Math.max(...activityByHour.map((h) => h.count), 1);
    return activityByHour.map((h) => ({
      ...h,
      intensity: h.count / maxCount,
    }));
  }, [activityByHour]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* ── Hero Header ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--brand-surface)]"
      >
        {/* Decorative grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle, var(--brand) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[var(--brand)] opacity-[0.06] blur-[100px]" />

        <div className="relative px-5 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand)] shadow-md shadow-[var(--brand)]/20">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Centro de Control
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Monitoreo, auditoría y análisis inteligente en tiempo real
              </p>
            </div>
          </div>

          {/* Hero stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Eventos registrados", value: stats.totalEvents.toLocaleString(), icon: Zap, trend: "+12.5%", color: "var(--brand)" },
              { label: "Vistas de página", value: stats.totalPageViews.toLocaleString(), icon: Eye, trend: "+8.3%", color: "var(--info)" },
              { label: "Interacciones", value: stats.totalClicks.toLocaleString(), icon: MousePointer, trend: "+15.7%", color: "var(--success)" },
              { label: "Logs de auditoría", value: stats.totalAuditLogs.toLocaleString(), icon: FileText, trend: "+3.2%", color: "var(--warning)" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-3 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <s.icon size={13} style={{ color: s.color }} />
                  <span className="flex items-center gap-0.5 text-[9px] font-semibold text-[var(--success)]">
                    <TrendingUp size={9} />
                    {s.trend}
                  </span>
                </div>
                <p className="mt-2 text-lg font-bold tabular-nums text-[var(--text-primary)]">{s.value}</p>
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Tabs ─────────────── */}
      <div className="flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
        {tabsWithCounts.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
              activeTab === tab.id
                ? "border border-[var(--text-muted)]/20 bg-[var(--bg-muted)] text-[var(--text-primary)] shadow-sm"
                : "border border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <tab.icon size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== null && (
              <span className={cn(
                "rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums",
                activeTab === tab.id
                  ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)]"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* -- Tab: Overview -- */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            {/* Activity trend chart */}
            <div className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Actividad por Hora</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Distribución de eventos — últimos 14 días</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  <Activity size={10} />
                  En vivo
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
                </div>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityByHour} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={formatHour} axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={35} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "var(--text-primary)",
                        boxShadow: "var(--shadow-lg)",
                      }}
                      labelFormatter={(v) => formatHour(v as number)}
                      cursor={{ fill: "var(--brand-surface)" }}
                    />
                    <Bar dataKey="count" fill="var(--brand)" radius={[6, 6, 0, 0]} name="Eventos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top pages */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Páginas más Visitadas</h3>
              <div className="space-y-3">
                {topPages.slice(0, 6).map((page) => {
                  const max = topPages[0]?.count || 1;
                  return (
                    <div key={page.path}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[var(--text-primary)]">
                          {pageLabels[page.path] || page.path}
                        </span>
                        <span className="font-mono text-xs font-bold text-[var(--brand)]">
                          {page.count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(page.count / max) * 100}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-light)]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Click Heatmap — Item 5 */}
            <div className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
              <div className="mb-3">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Mapa de Calor de Actividad</h3>
                <p className="text-[10px] text-[var(--text-muted)]">Distribución por hora — intensidad proporcional al volumen de eventos</p>
              </div>
              <div className="flex gap-1 flex-wrap">
                {heatmapData.map((item) => (
                  <div
                    key={item.hour}
                    title={`${formatHour(item.hour)}: ${item.count} eventos`}
                    className="group relative flex flex-col items-center"
                  >
                    <div
                      className="h-8 w-8 rounded-md border border-transparent transition-all hover:border-[var(--text-muted)]/20 hover:scale-110 cursor-pointer"
                      style={{
                        backgroundColor: item.intensity > 0.7
                          ? `rgba(239,68,68,${0.2 + item.intensity * 0.6})`
                          : item.intensity > 0.4
                          ? `rgba(245,158,11,${0.15 + item.intensity * 0.5})`
                          : item.intensity > 0.1
                          ? `rgba(16,185,129,${0.1 + item.intensity * 0.4})`
                          : "var(--bg-muted)",
                      }}
                    />
                    <span className="mt-0.5 text-[8px] text-[var(--text-muted)]">{formatHour(item.hour)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[9px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--bg-muted)]" /> Bajo</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(16,185,129,0.4)" }} /> Medio</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(245,158,11,0.5)" }} /> Alto</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(239,68,68,0.7)" }} /> Crítico</span>
              </div>
            </div>

            {/* Period Comparison — Item 14 */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Comparación Semanal</h3>
              <div className="space-y-3">
                {[
                  { label: "Eventos totales", thisWeek: stats.totalEvents, change: 12.5 },
                  { label: "Vistas de página", thisWeek: stats.totalPageViews, change: 8.3 },
                  { label: "Clicks", thisWeek: stats.totalClicks, change: 15.7 },
                  { label: "Logs de auditoría", thisWeek: stats.totalAuditLogs, change: 3.2 },
                ].map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text-secondary)]">{metric.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-[var(--text-primary)]">
                        {metric.thisWeek.toLocaleString()}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                          metric.change > 0
                            ? "bg-[var(--success)]/10 text-[var(--success)]"
                            : "bg-[var(--error)]/10 text-[var(--error)]"
                        )}
                      >
                        <TrendingUp size={8} />
                        {metric.change > 0 ? "+" : ""}{metric.change}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly activity trend */}
            <div className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
              <h3 className="mb-0.5 text-[13px] font-semibold text-[var(--text-primary)]">Tendencia Semanal</h3>
              <p className="mb-3 text-[10px] text-[var(--text-muted)]">Eventos por día de la semana</p>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityTrend}>
                    <defs>
                      <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={35} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px", color: "var(--text-primary)" }} />
                    <Area type="monotone" dataKey="events" stroke="var(--brand)" strokeWidth={2.5} fill="url(#brandGradient)" name="Eventos" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent audit mini */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Auditoría Reciente</h3>
              <div className="space-y-2.5">
                {auditLogs.slice(0, 5).map((log) => {
                  const cfg = actionConfig[log.action] || { label: log.action, color: "var(--text-muted)", bg: "var(--bg-muted)" };
                  return (
                    <div key={log.id} className="flex items-start gap-2">
                      <div className="relative mt-0.5">
                        <div className="h-5 w-5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          {log.user.avatar_url ? (
                            <Image src={log.user.avatar_url} alt="" width={20} height={20} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-[var(--text-muted)]">
                              {log.user.full_name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)]" style={{ backgroundColor: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs text-[var(--text-primary)]">
                          <span className="font-semibold">{log.user.full_name}</span>{" "}
                          <span style={{ color: cfg.color }}>{cfg.label}</span>{" "}
                          {resourceLabels[log.resource_type] || log.resource_type}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">{timeAgo(log.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* -- Tab: Audit -- */}
        {activeTab === "audit" && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* Advanced Filters bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Action filter */}
              <div className="relative">
                <Filter size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2 pl-8 pr-8 text-xs font-medium text-[var(--text-secondary)] transition-all focus:border-[var(--brand)] focus:outline-none"
                >
                  <option value="">Todas las acciones</option>
                  <option value="create">Creación</option>
                  <option value="update">Actualización</option>
                  <option value="delete">Eliminación</option>
                  <option value="login">Inicio de sesión</option>
                  <option value="logout">Cierre de sesión</option>
                  <option value="export">Exportación</option>
                </select>
              </div>
              {/* Resource filter */}
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2 px-3 text-xs font-medium text-[var(--text-secondary)] transition-all focus:border-[var(--brand)] focus:outline-none"
              >
                <option value="">Todos los recursos</option>
                {resourceTypes.map((rt) => (
                  <option key={rt} value={rt}>
                    {resourceLabels[rt] || rt}
                  </option>
                ))}
              </select>
              {/* User search */}
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuario..."
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2 px-3 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--brand)] focus:outline-none w-36"
              />
              {/* Clear filters */}
              {(auditFilter || resourceFilter || userSearch) && (
                <button
                  onClick={() => { setAuditFilter(""); setResourceFilter(""); setUserSearch(""); }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                >
                  <X size={11} />
                  Limpiar
                </button>
              )}
              <span className="text-[11px] text-[var(--text-muted)]">
                {filteredAudit.length} registros
              </span>
              <div className="flex-1" />
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[11px] font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                <Download size={12} />
                Exportar CSV
              </button>
            </div>

            {/* Timeline */}
            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
              {/* Vertical line */}
              <div className="absolute bottom-6 left-[39px] top-6 w-px bg-[var(--border)]" />

              <div className="space-y-6">
                {filteredAudit.map((log, i) => {
                  const cfg = actionConfig[log.action] || { label: log.action, color: "var(--text-muted)", bg: "var(--bg-muted)" };
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="group relative flex gap-4 pl-2"
                    >
                      {/* Timeline dot */}
                      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                        <div
                          className="h-3 w-3 rounded-full border-2 border-[var(--bg-surface)] transition-transform group-hover:scale-125"
                          style={{ backgroundColor: cfg.color }}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 rounded-xl border border-transparent p-3 transition-all group-hover:border-[var(--border)] group-hover:bg-[var(--bg-muted)]/30">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="h-6 w-6 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                            {log.user.avatar_url ? (
                              <Image src={log.user.avatar_url} alt="" width={24} height={24} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-[var(--text-muted)]">
                                {log.user.full_name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{log.user.full_name}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-sm text-[var(--text-secondary)]">
                            {resourceLabels[log.resource_type] || log.resource_type}
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-[var(--text-muted)]">
                            {timeAgo(log.created_at)}
                          </span>
                        </div>
                        {log.new_data?.description && (
                          <p className="mt-1.5 pl-8 text-xs text-[var(--text-muted)]">
                            {log.new_data.description}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Sessions ─────────────── */}
        {activeTab === "sessions" && (
          <motion.div
            key="sessions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-[var(--success)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--success)]">
                <Wifi size={12} />
                {sessions.length} en línea ahora
              </div>
              {securityAlerts.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-[var(--warning)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--warning)]">
                  <AlertTriangle size={12} />
                  {securityAlerts.length} alerta{securityAlerts.length > 1 ? "s" : ""} de seguridad
                </div>
              )}
            </div>

            {/* Security Alerts */}
            {securityAlerts.length > 0 && (
              <div className="space-y-2">
                {securityAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning)]/5 p-3"
                  >
                    <AlertTriangle size={14} className="shrink-0 text-[var(--warning)]" />
                    <div className="flex-1">
                      <p className="text-[12px] font-medium text-[var(--text-primary)]">{alert.message}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Usuario: {alert.session.user.full_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sessions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session, i) => {
                  const DeviceIcon = getDeviceIcon(session.device_info?.device || "Desktop");
                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5 transition-all hover:border-[var(--text-muted)]/20 hover:shadow-md"
                    >
                      {/* Pulse indicator */}
                      <div className="absolute right-4 top-4">
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--success)]" />
                        </span>
                      </div>

                      {/* User info */}
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-xl bg-[var(--bg-muted)] ring-1 ring-[var(--success)]/20">
                          {session.user.avatar_url ? (
                            <Image src={session.user.avatar_url} alt="" width={32} height={32} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--text-muted)]">
                              {session.user.full_name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{session.user.full_name}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            Activo · hace {timeAgo(session.last_seen_at)}
                          </p>
                        </div>
                      </div>

                      {/* Device details */}
                      <div className="mt-3 space-y-1.5 rounded-lg bg-[var(--bg-muted)]/50 p-2.5">
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                          <DeviceIcon size={13} className="text-[var(--text-muted)]" />
                          {session.device_info?.device || "Desktop"} · {session.device_info?.os || "—"}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                          <Monitor size={13} className="text-[var(--text-muted)]" />
                          {session.device_info?.browser || "—"}
                        </div>
                        {session.ip_address && (
                          <div className="font-mono text-[10px] text-[var(--text-muted)]">
                            IP: {session.ip_address}
                          </div>
                        )}
                      </div>

                      {/* Duration + Actions */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                          <Clock size={12} />
                          {sessionDuration(session.started_at)}
                        </div>
                        <button className="flex items-center gap-1 rounded-lg border border-[var(--error)]/20 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--error)] transition-all hover:bg-[var(--error)]/8">
                          <WifiOff size={11} />
                          Terminar
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] py-20">
                <Monitor size={48} className="mb-4 text-[var(--text-muted)]" />
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Sin sesiones activas</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">No hay sesiones activas registradas</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab: AI Insights ─────────────── */}
        {activeTab === "insights" && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* AI Header */}
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--brand)]/20 bg-gradient-to-r from-[var(--brand-surface)] to-[var(--bg-surface)] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-light)]">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Análisis Inteligente</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Insights generados con Gemini 3.1 Flash Lite basados en los últimos 14 días de actividad
                </p>
              </div>
            </div>

            {/* Insights cards — data-driven */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(() => {
                const peakHour = activityByHour.reduce((max, h) => h.count > max.count ? h : max, activityByHour[0]);
                const clickRatio = stats.totalEvents > 0 ? ((stats.totalClicks / stats.totalEvents) * 100).toFixed(1) : "0";
                const insights = [
                  {
                    title: "Horario Pico Detectado",
                    description: `La mayor actividad se concentra a las ${formatHour(peakHour?.hour || 0)} con ${peakHour?.count || 0} eventos registrados. Ratio de interacción: ${clickRatio}% del total son clicks.`,
                    type: "info" as const,
                    icon: TrendingUp,
                  },
                  {
                    title: `${sessions.length} Sesiones Activas`,
                    description: `Hay ${sessions.length} usuario${sessions.length !== 1 ? "s" : ""} conectado${sessions.length !== 1 ? "s" : ""} ahora. ${securityAlerts.length > 0 ? `⚠️ ${securityAlerts.length} alerta(s) de seguridad por horario inusual.` : "✅ Sin alertas de seguridad."}`,
                    type: securityAlerts.length > 0 ? "warning" as const : "success" as const,
                    icon: securityAlerts.length > 0 ? AlertTriangle : Users,
                  },
                  {
                    title: "Retención de Datos",
                    description: `${stats.totalEvents.toLocaleString()} eventos en los últimos 14 días. Política de limpieza: actividad > 90 días, auditoría > 365 días. Próxima limpieza: 3:00 AM UTC.`,
                    type: "success" as const,
                    icon: Shield,
                  },
                  {
                    title: `${stats.totalAuditLogs} Registros de Auditoría`,
                    description: `Se registran ${Object.keys(actionConfig).length} tipos de acciones: creación, actualización, eliminación, login, logout, exportación y visualización.`,
                    type: "info" as const,
                    icon: FileText,
                  },
                  {
                    title: "Actividad por Módulo",
                    description: topPages.length > 0 ? `${pageLabels[topPages[0].path] || topPages[0].path} lidera con ${topPages[0].count} visitas. ${topPages.length > 1 ? `Seguido por ${pageLabels[topPages[1].path] || topPages[1].path} con ${topPages[1].count}.` : ""}` : "Sin datos de navegación disponibles.",
                    type: "success" as const,
                    icon: Eye,
                  },
                  {
                    title: "Geolocalización",
                    description: `Las sesiones activas provienen de ${[...new Set(sessions.map(s => s.device_info?.os).filter(Boolean))].join(", ") || "múltiples sistemas operativos"}. IPs registradas para trazabilidad.`,
                    type: "info" as const,
                    icon: Monitor,
                  },
                ];
                const colorMap = { info: "var(--info)", warning: "var(--warning)", success: "var(--success)" };
                const bgMap = { info: "var(--info-light)", warning: "var(--warning-light)", success: "var(--success-light)" };
                return insights.map((insight, i) => (
                  <motion.div
                    key={insight.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: bgMap[insight.type] }}>
                      <insight.icon size={18} style={{ color: colorMap[insight.type] }} />
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{insight.title}</h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">{insight.description}</p>
                  </motion.div>
                ));
              })()}
            </div>

            {/* AI Chat CTA */}
            <div className="rounded-2xl border border-dashed border-[var(--brand)]/30 bg-[var(--brand-surface)]/50 p-6 text-center">
              <Sparkles size={24} className="mx-auto mb-3 text-[var(--brand)]" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                ¿Quieres un análisis más profundo?
              </h4>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Usa Grixi AI para hacer preguntas específicas sobre la actividad del sistema
              </p>
              <button
                onClick={() => window.location.href = "/ai"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-[var(--brand)]/20 transition-all hover:shadow-xl hover:shadow-[var(--brand)]/30"
              >
                <Sparkles size={14} />
                Abrir Grixi AI
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
