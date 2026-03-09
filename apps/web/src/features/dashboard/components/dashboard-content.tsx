"use client";

import { motion } from "framer-motion";
import {
  Users,
  Package,
  Warehouse,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type KPIs = {
  totalUsers: number;
  totalProducts: number;
  totalWarehouses: number;
  recentActivity: number;
};

type AuditLog = {
  id: string;
  action: string;
  resource_type: string;
  new_data: { description?: string } | null;
  created_at: string;
  user: { full_name: string; avatar_url: string | null };
};

type ChartData = { day: string; count: number };

type DashboardContentProps = {
  kpis: KPIs;
  activityChartData: ChartData[];
  recentAudit: AuditLog[];
};

const kpiConfig = [
  {
    key: "totalUsers" as const,
    label: "Usuarios",
    icon: Users,
    color: "var(--brand)",
    bgColor: "var(--brand-surface)",
    trend: "+12%",
    trendUp: true,
  },
  {
    key: "totalProducts" as const,
    label: "Productos",
    icon: Package,
    color: "var(--info)",
    bgColor: "var(--info-light)",
    trend: "+8%",
    trendUp: true,
  },
  {
    key: "totalWarehouses" as const,
    label: "Almacenes",
    icon: Warehouse,
    color: "var(--success)",
    bgColor: "var(--success-light)",
    trend: "Estable",
    trendUp: true,
  },
  {
    key: "recentActivity" as const,
    label: "Actividad (24h)",
    icon: Activity,
    color: "var(--warning)",
    bgColor: "var(--warning-light)",
    trend: "+23%",
    trendUp: true,
  },
];

const actionLabels: Record<string, string> = {
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
};

const resourceLabels: Record<string, string> = {
  user: "usuario",
  warehouse: "almacén",
  product: "producto",
  inventory: "inventario",
  role: "rol",
  session: "sesión",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardContent({
  kpis,
  activityChartData,
  recentAudit,
}: DashboardContentProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-sm font-bold text-[var(--text-primary)]">
          Dashboard
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
          {getGreeting()}, Mariana — Resumen de GRIXI Industrial S.A.
        </p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiConfig.map((kpi, index) => (
          <motion.div
            key={kpi.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="group rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5 card-elevated"
          >
            <div className="flex items-start justify-between">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: kpi.bgColor }}
              >
                <kpi.icon size={14} style={{ color: kpi.color }} />
              </div>
              <div
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium",
                  kpi.trendUp
                    ? "bg-[var(--success-light)] text-[var(--success)]"
                    : "bg-[var(--error-light)] text-[var(--error)]"
                )}
              >
                {kpi.trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {kpi.trend}
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {kpis[kpi.key].toLocaleString()}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                Actividad de la Semana
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Eventos registrados por día
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
              Últimos 7 días
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityChartData}>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "var(--shadow-lg)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                  }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  fill="url(#activityGradient)"
                  name="Eventos"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Audit */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">
            Actividad Reciente
          </h3>
          <div className="space-y-2.5">
            {recentAudit.slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  {log.user.avatar_url ? (
                    <Image
                      src={log.user.avatar_url}
                      alt={log.user.full_name}
                      width={20}
                      height={20}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] font-medium text-[var(--text-muted)]">
                      {log.user.full_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[11px] text-[var(--text-primary)]">
                    <span className="font-medium">{log.user.full_name}</span>{" "}
                    <span className="text-[var(--text-secondary)]">
                      {actionLabels[log.action] || log.action}{" "}
                      {resourceLabels[log.resource_type] || log.resource_type}
                    </span>
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {timeAgo(log.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
