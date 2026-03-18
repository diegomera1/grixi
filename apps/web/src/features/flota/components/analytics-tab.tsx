"use client";

import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { KPISnapshot, Equipment, WorkOrder } from "../types";
import {
  EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
  WO_PRIORITY_COLORS,
} from "../types";

// Custom tooltip for dark theme
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/95 px-3 py-2 text-[10px] shadow-xl backdrop-blur-md">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-bold">
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

export function AnalyticsTab({ kpis, equipment, workOrders }: { kpis: KPISnapshot[]; equipment: Equipment[]; workOrders: WorkOrder[] }) {
  const criticalEquipment = equipment.filter((e) => e.criticality === "critical");
  const woByCost = workOrders.filter((w) => w.cost_estimated > 0).sort((a, b) => b.cost_estimated - a.cost_estimated).slice(0, 5);

  // Chart data
  const trendData = kpis.map((kpi) => ({
    month: new Date(kpi.snapshot_date).toLocaleDateString("es-EC", { month: "short" }),
    disponibilidad: kpi.availability_pct,
    mtbf: kpi.mtbf_hours,
    costo: kpi.maintenance_cost / 1000,
  }));

  // WO priority distribution
  const priorityCounts = {
    critical: workOrders.filter((w) => w.priority === "critical").length,
    high: workOrders.filter((w) => w.priority === "high").length,
    medium: workOrders.filter((w) => w.priority === "medium").length,
    low: workOrders.filter((w) => w.priority === "low").length,
  };
  const pieData = [
    { name: "Crítica", value: priorityCounts.critical, color: WO_PRIORITY_COLORS.critical },
    { name: "Alta", value: priorityCounts.high, color: WO_PRIORITY_COLORS.high },
    { name: "Media", value: priorityCounts.medium, color: WO_PRIORITY_COLORS.medium },
    { name: "Baja", value: priorityCounts.low, color: WO_PRIORITY_COLORS.low },
  ].filter((d) => d.value > 0);

  // Top cost WOs bar data
  const costBarData = woByCost.map((wo) => ({
    name: wo.wo_number,
    title: wo.title,
    costo: wo.cost_estimated,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Availability Trend — AreaChart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Tendencia Disponibilidad
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="gradDisp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[80, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={95} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Meta 95%", position: "right", fill: "#F59E0B", fontSize: 9 }} />
            <Area
              type="monotone"
              dataKey="disponibilidad"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#gradDisp)"
              name="Disponibilidad %"
              dot={{ fill: "#10B981", r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* MTBF Trend — AreaChart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Tendencia MTBF (horas)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="gradMTBF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={500} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Meta 500h", position: "right", fill: "#F59E0B", fontSize: 9 }} />
            <Area
              type="monotone"
              dataKey="mtbf"
              stroke="#0EA5E9"
              strokeWidth={2}
              fill="url(#gradMTBF)"
              name="MTBF h"
              dot={{ fill: "#0EA5E9", r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* WOs por Prioridad — PieChart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          OTs por Prioridad
        </h3>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] text-[var(--text-primary)]">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">{d.value}</span>
              </div>
            ))}
            <div className="border-t border-[var(--border)] pt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">Total</span>
              <span className="text-sm font-bold text-[#0EA5E9]">{workOrders.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top OTs por Costo — BarChart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Top OTs por Costo Estimado
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={costBarData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#0EA5E9", fontSize: 9 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="costo" name="Costo $" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Costo Mantenimiento Trend */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Costo Mantenimiento Mensual ($k)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="costo"
              stroke="#8B5CF6"
              strokeWidth={2}
              fill="url(#gradCost)"
              name="Costo $k"
              dot={{ fill: "#8B5CF6", r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
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
    </div>
  );
}
