"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp, ArrowDown, Minus, MapPin, Activity,
  DollarSign, Fuel, Shield,
  FileText, Bell, Navigation, Wrench, ClipboardCheck,
  BookOpen, CheckCircle2,
} from "lucide-react";
import type { KPISnapshot, WorkOrder, Equipment, VesselZone, LogbookEntry, FleetAlert, FleetCertificate, FuelLog, FlotaKPIs } from "../types";
import {
  WO_PRIORITY_LABELS, WO_PRIORITY_COLORS,
  WO_STATUS_LABELS, WO_STATUS_COLORS,
  ZONE_TYPE_COLORS,
} from "../types";
import type { useFlotaDemo } from "../hooks/use-flota-demo";

const VesselMap = dynamic(() => import("./vessel-map").then((m) => m.VesselMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
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
  logbook: LogbookEntry[];
  alerts: FleetAlert[];
  certificates: FleetCertificate[];
  fuelLogs: FuelLog[];
  stats: FlotaKPIs;
};

// ── Helper Components ────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <ArrowUp size={10} className="text-red-400" />;
  if (trend === "down") return <ArrowDown size={10} className="text-green-400" />;
  return <Minus size={10} className="text-[var(--text-muted)]" />;
}

const LOGBOOK_ICONS: Record<string, string> = {
  navegacion: "🚢",
  incidente: "⚠️",
  inspeccion: "🔍",
  cambio_guardia: "🔄",
  maniobra: "⚓",
  avistamiento: "👁️",
  comunicacion: "📡",
};

const ALERT_SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  emergency: { bg: "rgba(239,68,68,0.15)", text: "#EF4444", border: "rgba(239,68,68,0.3)" },
  critical: { bg: "rgba(239,68,68,0.1)", text: "#EF4444", border: "rgba(239,68,68,0.2)" },
  warning: { bg: "rgba(245,158,11,0.1)", text: "#F59E0B", border: "rgba(245,158,11,0.2)" },
  info: { bg: "rgba(14,165,233,0.1)", text: "#0EA5E9", border: "rgba(14,165,233,0.2)" },
};

const CERT_STATUS_COLORS: Record<string, string> = {
  active: "#10B981",
  expiring_soon: "#F59E0B",
  expired: "#EF4444",
  suspended: "#6B7280",
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const now = new Date();
  const target = new Date(date);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Animated Counter ─────────────────────────────

function AnimatedValue({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="tabular-nums"
    >
      {prefix}{typeof value === "number" && !isNaN(value) ? value.toLocaleString("es-EC", { maximumFractionDigits: 1 }) : "—"}{suffix}
    </motion.span>
  );
}

// ── KPI Gauge (semicircle) ───────────────────────

function KPIGauge({ value, max = 100, label, color, unit = "%" }: { value: number; max?: number; label: string; color: string; unit?: string }) {
  const pct = Math.min(value / max, 1);
  const r = 38;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <svg width="90" height="52" viewBox="0 0 90 52">
        {/* Background arc */}
        <path
          d="M 7 48 A 38 38 0 0 1 83 48"
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <motion.path
          d="M 7 48 A 38 38 0 0 1 83 48"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <p className="mt-1 text-lg font-bold tabular-nums" style={{ color }}>
        <AnimatedValue value={value} suffix={unit} />
      </p>
      <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────

export function DashboardTab({
  kpis, workOrders, equipment, zones, events, readings,
  logbook, alerts, certificates, fuelLogs, stats,
}: DashboardTabProps) {
  const activeWOs = workOrders.filter((wo) => ["in_progress", "assigned"].includes(wo.status)).slice(0, 5);
  const activeAlerts = alerts.filter((a) => !a.resolved_at);
  const expiringCerts = certificates.filter((c) => c.status === "expiring_soon" || c.status === "expired");

  // Fuel calculations
  const navLogs = fuelLogs.filter((f) => f.consumption_rate_mt_day && f.consumption_rate_mt_day > 0).slice(0, 14);
  const latestFuel = fuelLogs.find((f) => f.rob_after && f.rob_after > 0);
  const avgConsumption = stats.avgFuelConsumption;
  const autonomyDays = latestFuel && avgConsumption > 0 ? Math.floor((latestFuel.rob_after || 0) / avgConsumption) : 0;

  return (
    <div className="space-y-4">
      {/* ── Row 1: KPI Gauges ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4 flex flex-col items-center"
        >
          <KPIGauge value={stats.availability} label="Disponibilidad" color="#10B981" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4 flex flex-col items-center"
        >
          <KPIGauge value={stats.mtbf} max={1500} label="MTBF" color="#0EA5E9" unit="h" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4 flex flex-col items-center"
        >
          <KPIGauge value={stats.mttr} max={24} label="MTTR" color="#F59E0B" unit="h" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-blue-500/10 p-1.5"><Wrench size={14} className="text-blue-500" /></div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">OT Abiertas</span>
          </div>
          <p className="text-2xl font-bold text-blue-500"><AnimatedValue value={stats.openWOs} /></p>
          <p className="text-[9px] text-[var(--text-muted)]">{workOrders.filter((w) => w.status === "completed").length} completadas</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-amber-500/10 p-1.5"><DollarSign size={14} className="text-amber-500" /></div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Costo Mtto</span>
          </div>
          <p className="text-2xl font-bold text-amber-500"><AnimatedValue value={stats.maintenanceCostMonth / 1000} prefix="$" suffix="k" /></p>
          <p className="text-[9px] text-[var(--text-muted)]">Mensual</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-emerald-500/10 p-1.5"><Shield size={14} className="text-emerald-500" /></div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Certificados</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{certificates.length}</p>
          {expiringCerts.length > 0 && (
            <p className="text-[9px] font-medium text-amber-500">⚠ {expiringCerts.length} por vencer</p>
          )}
        </motion.div>
      </div>

      {/* ── Row 2: Alerts + Fuel + Readings ── */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Active Alerts */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <Bell size={13} className="text-red-500" />
              Alertas Activas
              {activeAlerts.length > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500 animate-pulse">
                  {activeAlerts.length}
                </span>
              )}
            </h3>
          </div>
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {activeAlerts.slice(0, 6).map((alert) => {
              const colors = ALERT_SEVERITY_COLORS[alert.severity] || ALERT_SEVERITY_COLORS.info;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg p-2.5 border"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors.text }} />
                        <span className="text-[10px] font-bold uppercase" style={{ color: colors.text }}>
                          {alert.severity}
                        </span>
                        <span className="text-[8px] text-[var(--text-muted)]">· {alert.alert_type}</span>
                      </div>
                      <p className="text-[11px] font-medium text-[var(--text-primary)] mt-0.5 truncate">{alert.title}</p>
                      {alert.equipment_name && (
                        <p className="text-[9px] text-[var(--text-secondary)]">🔧 {alert.equipment_name}</p>
                      )}
                    </div>
                    <span className="text-[8px] text-[var(--text-muted)] shrink-0">{timeAgo(alert.created_at)}</span>
                  </div>
                </motion.div>
              );
            })}
            {activeAlerts.length === 0 && (
              <div className="flex flex-col items-center py-6">
                <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
                <p className="text-xs text-[var(--text-muted)]">Sin alertas activas</p>
              </div>
            )}
          </div>
        </div>

        {/* Fuel & Efficiency */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <Fuel size={13} className="text-orange-500" />
            Combustible
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg bg-[var(--bg-muted)]/40 p-3 text-center">
              <p className="text-[9px] font-medium text-[var(--text-muted)]">ROB Total</p>
              <p className="text-xl font-bold text-orange-500">{stats.fuelROB.toFixed(0)}<span className="text-[10px] font-normal ml-1">MT</span></p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)]/40 p-3 text-center">
              <p className="text-[9px] font-medium text-[var(--text-muted)]">Consumo Prom.</p>
              <p className="text-xl font-bold text-blue-500">{avgConsumption.toFixed(1)}<span className="text-[10px] font-normal ml-1">MT/día</span></p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)]/40 p-3 text-center">
              <p className="text-[9px] font-medium text-[var(--text-muted)]">Autonomía</p>
              <p className="text-xl font-bold text-emerald-500">{autonomyDays}<span className="text-[10px] font-normal ml-1">días</span></p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)]/40 p-3 text-center">
              <p className="text-[9px] font-medium text-[var(--text-muted)]">Vel. Promedio</p>
              <p className="text-xl font-bold text-cyan-500">
                {navLogs.length > 0 ? (navLogs.reduce((s, f) => s + (f.avg_speed_kts || 0), 0) / navLogs.length).toFixed(1) : "—"}
                <span className="text-[10px] font-normal ml-1">kts</span>
              </p>
            </div>
          </div>
          {/* Mini fuel bar chart */}
          <div className="flex items-end gap-0.5 h-16 mt-2">
            {navLogs.slice(0, 14).reverse().map((f, i) => {
              const h = f.consumption_rate_mt_day ? Math.min((f.consumption_rate_mt_day / 25) * 100, 100) : 0;
              return (
                <motion.div
                  key={f.id}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.03, duration: 0.5 }}
                  className="flex-1 rounded-t-sm"
                  style={{ backgroundColor: h > 80 ? "#EF4444" : h > 60 ? "#F59E0B" : "#0EA5E9", opacity: 0.7 + (i / 14) * 0.3 }}
                  title={`${f.log_date}: ${f.consumption_rate_mt_day} MT/día`}
                />
              );
            })}
          </div>
          <p className="text-[8px] text-[var(--text-muted)] text-center mt-1">Consumo últimos 14 días navegación</p>
        </div>

        {/* Live Readings */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0EA5E9]">
              <Activity size={13} />
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Lecturas en Vivo
            </h3>
            <span className="text-[8px] text-[var(--text-muted)]">3s</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {readings.slice(0, 6).map((r) => (
              <motion.div
                key={r.name}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/30 p-2.5"
                animate={{
                  borderColor: r.trend !== "stable" ? "rgba(14,165,233,0.3)" : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-medium text-[var(--text-secondary)] truncate">{r.name}</span>
                  <TrendIcon trend={r.trend} />
                </div>
                <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: r.color }}>
                  {r.value.toFixed(1)}
                  <span className="text-[9px] font-normal text-[var(--text-muted)] ml-0.5">{r.unit}</span>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Map + Logbook + Certificates ── */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <VesselMap compact />
        </div>

        {/* Logbook Timeline */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 max-h-[400px] overflow-hidden">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <BookOpen size={13} className="text-indigo-500" />
            Bitácora
          </h3>
          <div className="space-y-2 overflow-y-auto max-h-[330px] pr-1">
            {logbook.slice(0, 10).map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2.5 group"
              >
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-sm">{LOGBOOK_ICONS[entry.entry_type] || "📝"}</span>
                  <div className="w-px flex-1 bg-[var(--border)] group-last:bg-transparent mt-1" />
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{entry.title}</p>
                    <span className="text-[8px] text-[var(--text-muted)] shrink-0">{timeAgo(entry.created_at)}</span>
                  </div>
                  {entry.content && (
                    <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{entry.content}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[8px] text-[var(--text-muted)]">
                    {entry.shift === "noche" ? "🌙" : "☀️"}
                    {entry.sea_state && <span>🌊 {entry.sea_state}</span>}
                    {entry.wind_speed !== null && <span>💨 {entry.wind_speed} kts</span>}
                  </div>
                </div>
              </motion.div>
            ))}
            {logbook.length === 0 && (
              <p className="text-center text-xs text-[var(--text-muted)] py-8">Sin entradas en bitácora</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 4: Certificates + Active Work Orders + Zones ── */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Certificates */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <FileText size={13} className="text-emerald-500" />
            Certificados IMO
          </h3>
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {certificates.map((cert) => {
              const days = daysUntil(cert.expiry_date);
              const statusColor = CERT_STATUS_COLORS[cert.status] || CERT_STATUS_COLORS.active;
              return (
                <div
                  key={cert.id}
                  className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{cert.cert_type}</p>
                      <p className="text-[8px] text-[var(--text-muted)] truncate">{cert.issued_by}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {days !== null ? (
                      <span className={`text-[10px] font-bold tabular-nums ${days < 30 ? "text-red-500" : days < 90 ? "text-amber-500" : "text-emerald-500"}`}>
                        {days > 0 ? `${days}d` : "Vencido"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">∞</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Work Orders */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <ClipboardCheck size={13} className="text-blue-500" />
            OT Activas
          </h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
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
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            <Navigation size={13} className="text-cyan-500" />
            Zonas del Buque
          </h3>
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {zones.map((z) => {
              const count = equipment.filter((e) => e.zone_id === z.id).length;
              const alertCount = equipment.filter((e) => e.zone_id === z.id && e.status !== "operational").length;
              if (count === 0) return null;
              return (
                <div key={z.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ZONE_TYPE_COLORS[z.zone_type] }} />
                    <span className="text-[11px] font-medium text-[var(--text-primary)]">{z.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-muted)]">{count} eq.</span>
                    {alertCount > 0 && (
                      <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[8px] font-bold text-red-500">
                        {alertCount} ⚠
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 5: KPI Trend (sparklines) ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Tendencia KPIs — Últimos 6 Meses
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-7">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg bg-[var(--bg-muted)]/30 p-3 text-center"
            >
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {new Date(kpi.snapshot_date).toLocaleDateString("es-EC", { month: "short", year: "2-digit" })}
              </p>
              <p className="mt-2 text-lg font-bold text-[#10B981]">{kpi.availability_pct}%</p>
              <p className="text-[8px] text-[var(--text-muted)]">Disponibilidad</p>
              <div className="mt-2 flex items-center justify-center gap-3 text-[10px]">
                <span className="font-medium text-[#0EA5E9]">{kpi.mtbf_hours}h</span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="font-medium text-[#F59E0B]">${(kpi.maintenance_cost / 1000).toFixed(1)}k</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Row 6: Event Feed ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 max-h-[200px] overflow-hidden">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Feed en Vivo
        </h3>
        <div className="space-y-1.5 overflow-y-auto max-h-[140px] pr-1">
          <AnimatePresence initial={false}>
            {events.slice(0, 8).map((evt) => (
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
    </div>
  );
}
