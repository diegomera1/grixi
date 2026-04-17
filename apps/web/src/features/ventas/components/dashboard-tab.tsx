"use client";

import { useRef, useState, useMemo } from "react";
import { fmtMoney, fmtMoneyCompact, fmtNum } from "../utils/fmtMoney";
import { motion, useInView } from "framer-motion";
import {
  DollarSign,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
  CheckCircle2,
  Bell,
  X,
  Package,
  ShoppingCart,
  Receipt,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type {
  VentasKPIs,
  SalesCustomer,
  SalesOpportunity,
  SalesInvoice,
  SalesAlert,
  SalesPipelineStage,
  DemoRole,
  TopProduct,
} from "../types";
import {
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  INVOICE_STATUS_COLORS,
  ALERT_SEVERITY_COLORS,
} from "../types";
import { markAlertRead } from "../actions/ventas-actions";
import { ForecastSection } from "./forecast-section";

// ── Animated Counter ──────────────────────────────

function AnimatedValue({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      className="tabular-nums"
    >
      {isInView && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {prefix === "$"
            ? fmtMoneyCompact(value)
            : `${prefix}${fmtNum(value, decimals)}${suffix}`}
        </motion.span>
      )}
    </motion.span>
  );
}

// ── Sparkline SVG ─────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 64;
  const h = 20;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const gradientId = `spark-${color.replace("#", "")}`;
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────

function KPICard({
  label,
  value,
  prefix,
  suffix,
  change,
  changeLabel,
  icon: Icon,
  color,
  delay,
  sparkData,
  yoyLabel,
  tooltip,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeLabel?: string;
  icon: typeof DollarSign;
  color: string;
  delay: number;
  sparkData?: number[];
  yoyLabel?: string;
  tooltip?: string;
}) {
  const isPositive = (change || 0) >= 0;
  const [showTip, setShowTip] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="group relative rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-all hover:shadow-md"
    >
      {/* Glow */}
      <div
        className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
              {label}
            </p>
            {tooltip && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTip(true)}
                  onMouseLeave={() => setShowTip(false)}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] transition-colors hover:bg-[var(--brand)]/10 hover:text-[var(--brand)]"
                  aria-label={`Info: ${label}`}
                >
                  <span className="text-[7px] font-bold leading-none">i</span>
                </button>
                {showTip && (
                  <div className="absolute bottom-full left-1/2 z-[100] mb-1.5 w-52 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2.5 shadow-xl">
                    <p className="text-[8px] leading-relaxed text-[var(--text-secondary)]">{tooltip}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-xl font-bold text-[var(--text-primary)]">
            <AnimatedValue value={value} prefix={prefix} suffix={suffix} />
          </p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      {/* Sparkline */}
      {sparkData && sparkData.length > 0 && (
        <div className="mt-1.5">
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        {change !== undefined && (
          <div className="flex items-center gap-0.5">
            {isPositive ? (
              <ArrowUpRight size={10} className="text-emerald-500" />
            ) : (
              <ArrowDownRight size={10} className="text-red-500" />
            )}
            <span
              className={cn(
                "text-[9px] font-semibold",
                isPositive ? "text-emerald-500" : "text-red-500"
              )}
            >
              {isPositive ? "+" : ""}
              {change}%
            </span>
            {changeLabel && (
              <span className="text-[8px] text-[var(--text-muted)]">
                {changeLabel}
              </span>
            )}
          </div>
        )}
        {yoyLabel && (
          <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[7px] font-medium text-[var(--text-muted)]">
            {yoyLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Mini Pipeline ─────────────────────────────────

function MiniPipelineBar({
  stages,
  opportunities,
}: {
  stages: SalesPipelineStage[];
  opportunities: SalesOpportunity[];
}) {
  const stageData = stages
    .filter((s) => !s.is_lost)
    .map((stage) => {
      const count = opportunities.filter((o) => o.stage_id === stage.id).length;
      const amount = opportunities
        .filter((o) => o.stage_id === stage.id)
        .reduce((sum, o) => sum + Number(o.amount), 0);
      return { name: stage.name, count, amount, color: stage.color };
    });

  const total = stageData.reduce((s, d) => s + d.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">
          Pipeline
        </h3>
        <span className="text-[10px] text-[var(--text-muted)]">
          {total} deals activos
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--bg-muted)]">
        {stageData.map((stage, i) => (
          <motion.div
            key={stage.name}
            initial={{ width: 0 }}
            animate={{
              width: total > 0 ? `${(stage.count / total) * 100}%` : "0%",
            }}
            transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
            className="h-full"
            style={{ backgroundColor: stage.color }}
            title={`${stage.name}: ${stage.count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {stageData.map((stage) => (
          <div key={stage.name} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-[9px] text-[var(--text-muted)]">
              {stage.name}
            </span>
            <span className="text-[9px] font-semibold text-[var(--text-secondary)]">
              {stage.count}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Alerts Panel ──────────────────────────────────

function AlertsPanel({
  alerts,
  onDismiss,
}: {
  alerts: SalesAlert[];
  onDismiss: (id: string) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Bell size={13} className="text-amber-500" />
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">
          Alertas Activas
        </h3>
        <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500">
          {alerts.length}
        </span>
      </div>

      <div className="space-y-2">
        {alerts.slice(0, 5).map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.05 }}
            className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--bg-muted)]"
          >
            <div
              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: ALERT_SEVERITY_COLORS[alert.severity],
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="truncate text-[10px] font-medium text-[var(--text-primary)]">
                {alert.title}
              </p>
              {alert.message && (
                <p className="mt-0.5 truncate text-[9px] text-[var(--text-muted)]">
                  {alert.message}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                await markAlertRead(alert.id);
                onDismiss(alert.id);
              }}
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X size={11} className="text-[var(--text-muted)]" />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Conversion Funnel ─────────────────────────────

function ConversionFunnel({
  stages,
  opportunities,
}: {
  stages: SalesPipelineStage[];
  opportunities: SalesOpportunity[];
}) {
  const sortedStages = stages
    .filter((s) => !s.is_lost)
    .sort((a, b) => a.position - b.position);

  const funnelData = sortedStages.map((stage) => {
    const count = opportunities.filter((o) => o.stage_id === stage.id).length;
    return { name: stage.name, count, color: stage.color };
  });

  const maxCount = Math.max(...funnelData.map((d) => d.count), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <h3 className="mb-3 text-[11px] font-semibold text-[var(--text-primary)]">
        Funnel de Conversión
      </h3>
      <div className="space-y-2">
        {funnelData.map((step, i) => (
          <div key={step.name} className="flex items-center gap-3">
            <span className="w-20 text-right text-[9px] text-[var(--text-muted)] truncate">
              {step.name}
            </span>
            <div className="flex-1 h-6 relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(step.count / maxCount) * 100}%`,
                }}
                transition={{ delay: 0.7 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-r-md flex items-center"
                style={{ backgroundColor: `${step.color}25` }}
              >
                <div
                  className="h-full rounded-r-md"
                  style={{
                    backgroundColor: step.color,
                    width: "100%",
                    opacity: 0.7,
                  }}
                />
              </motion.div>
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[var(--text-primary)]">
                {step.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Revenue Chart ─────────────────────────────────

function RevenueChart({ invoices }: { invoices: SalesInvoice[] }) {
  const [comparison, setComparison] = useState<'month' | 'quarter'>('month');

  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];

  const monthlyData = months.map((month, i) => {
    const current = invoices.filter((inv) => {
      const d = new Date(inv.sale_date);
      return d.getMonth() === i && d.getFullYear() === 2026;
    });
    // Simulated previous period (demo)
    const prevFactor = 0.7 + Math.random() * 0.5;
    const currentRev = current.reduce((s, inv) => s + Number(inv.total_usd), 0);
    return {
      month,
      actual: currentRev,
      anterior: Math.round(currentRev * prevFactor),
      count: current.length,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">
          Ingresos Mensuales (USD)
        </h3>
        <div className="flex gap-1">
          {(["month", "quarter"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setComparison(opt)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[8px] font-medium transition-all",
                comparison === opt
                  ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              {opt === "month" ? "Mes vs Anterior" : "Trimestre"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 9, fill: "var(--text-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--text-muted)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtMoneyCompact(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 10,
              }}
              formatter={(value, name) => [
                fmtMoney(Number(value), 0),
                name === "actual" ? "Actual" : "Anterior",
              ]}
            />
            <Area
              type="monotone"
              dataKey="anterior"
              stroke="#6B7280"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="none"
              name="anterior"
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              name="actual"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ── Top Customers ─────────────────────────────────

function TopCustomers({ customers }: { customers: SalesCustomer[] }) {
  const top5 = customers
    .filter((c) => c.total_revenue > 0)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <h3 className="mb-3 text-[11px] font-semibold text-[var(--text-primary)]">
        Top Clientes por Revenue
      </h3>
      <div className="space-y-2.5">
        {top5.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-muted)]"
          >
            <span className="text-[9px] font-bold text-[var(--text-muted)] w-4">
              #{i + 1}
            </span>
            {c.logo_url ? (
              <img
                src={c.logo_url}
                alt=""
                className="h-6 w-6 rounded-md object-cover ring-1 ring-[var(--border)]"
              />
            ) : (
              <div className="h-6 w-6 rounded-md bg-[var(--bg-muted)] flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)]">
                {c.business_name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-[10px] font-medium text-[var(--text-primary)]">
                {c.trade_name || c.business_name}
              </p>
              <p className="text-[8px] text-[var(--text-muted)]">
                {c.country} · {c.total_orders} pedidos
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-[var(--text-primary)]">
                {fmtMoneyCompact(c.total_revenue)}
              </p>
              <div
                className="mt-0.5 rounded-full px-1.5 py-0.5 text-[7px] font-semibold"
                style={{
                  backgroundColor: `${SEGMENT_COLORS[c.segment]}15`,
                  color: SEGMENT_COLORS[c.segment],
                }}
              >
                {SEGMENT_LABELS[c.segment]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Top Products ──────────────────────────────────

function TopProducts({ products }: { products: TopProduct[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.58, duration: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <h3 className="mb-3 text-[11px] font-semibold text-[var(--text-primary)]">
        Top Productos por Revenue
      </h3>
      <div className="space-y-2.5">
        {products.map((p, i) => (
          <div
            key={p.product_id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-muted)]"
          >
            <span className="text-[9px] font-bold text-[var(--text-muted)] w-4">
              #{i + 1}
            </span>
            {p.image_url ? (
              <img
                src={p.image_url}
                alt=""
                className="h-6 w-6 rounded-md object-cover ring-1 ring-[var(--border)]"
              />
            ) : (
              <div className="h-6 w-6 rounded-md bg-[var(--bg-muted)] flex items-center justify-center">
                <Package size={10} className="text-[var(--text-muted)]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-[10px] font-medium text-[var(--text-primary)]">
                {p.name}
              </p>
              <p className="text-[8px] text-[var(--text-muted)]">
                {p.units} uds · {p.invoices} facturas
              </p>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-primary)]">
              {fmtMoneyCompact(p.revenue)}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Activity Feed ─────────────────────────────────

const ACTIVITY_ICONS: Record<string, typeof DollarSign> = {
  call: Clock,
  email: FileText,
  meeting: Users,
  note: FileText,
  sale: DollarSign,
  quote: FileText,
};

const DEMO_ACTIVITY_FEED = [
  { type: "sale", text: "Nueva venta FAC-2026-087 por $24,500", person: "Valentina Espinoza", avatar: "https://randomuser.me/api/portraits/women/44.jpg", time: "hace 12 min", color: "#10B981" },
  { type: "quote", text: "Cotización COT-2026-034 enviada a Cargill IS", person: "Sebastián Paredes", avatar: "https://randomuser.me/api/portraits/men/67.jpg", time: "hace 45 min", color: "#8B5CF6" },
  { type: "call", text: "Llamada con Nestlé LATAM — seguimiento contrato", person: "Andrés Villacrés", avatar: "https://randomuser.me/api/portraits/men/45.jpg", time: "hace 1h", color: "#3B82F6" },
  { type: "meeting", text: "Reunión cerrada con Procter & Gamble", person: "Valentina Espinoza", avatar: "https://randomuser.me/api/portraits/women/44.jpg", time: "hace 2h", color: "#F59E0B" },
  { type: "sale", text: "Venta FAC-2026-085 confirmada — $18,200", person: "Sebastián Paredes", avatar: "https://randomuser.me/api/portraits/men/67.jpg", time: "hace 3h", color: "#10B981" },
  { type: "email", text: "Propuesta enviada a BASF Chemical S.A.", person: "Camila Restrepo", avatar: "https://randomuser.me/api/portraits/women/68.jpg", time: "hace 4h", color: "#06B6D4" },
  { type: "quote", text: "Cotización COT-2026-033 aprobada por 3M Industrial", person: "Isabella Navarro", avatar: "https://randomuser.me/api/portraits/women/29.jpg", time: "hace 5h", color: "#10B981" },
  { type: "note", text: "Nota: Actualizar condiciones de crédito Siemens", person: "Andrés Villacrés", avatar: "https://randomuser.me/api/portraits/men/45.jpg", time: "hace 6h", color: "#6B7280" },
];

function ActivityFeed() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.75, duration: 0.4 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#3B82F6]/10">
          <Clock size={10} className="text-[#3B82F6]" />
        </div>
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">
          Actividad Reciente
        </h3>
        <div className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[8px] text-emerald-500 font-medium">En vivo</span>
      </div>

      <div className="space-y-1">
        {DEMO_ACTIVITY_FEED.map((act, i) => {
          const Icon = ACTIVITY_ICONS[act.type] || FileText;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.04 }}
              className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--bg-muted)]"
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${act.color}15` }}
              >
                <Icon size={9} style={{ color: act.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-[var(--text-primary)] leading-tight">
                  {act.text}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <img src={act.avatar} alt="" className="h-3 w-3 rounded-full object-cover" />
                  <span className="text-[7px] text-[var(--text-muted)]">{act.person}</span>
                  <span className="text-[7px] text-[var(--text-muted)]">&middot;</span>
                  <span className="text-[7px] text-[var(--text-muted)]">{act.time}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Main Dashboard Export ─────────────────────────

type DashboardProps = {
  kpis: VentasKPIs;
  customers: SalesCustomer[];
  opportunities: SalesOpportunity[];
  invoices: SalesInvoice[];
  alerts: SalesAlert[];
  pipelineStages: SalesPipelineStage[];
  topProducts: TopProduct[];
  demoRole: DemoRole;
  onAlertDismiss: (id: string) => void;
};

// Synthetic sparkline data (6 months) for demo
const SPARK_REVENUE  = [820000, 940000, 880000, 1050000, 1120000, 1240000];
const SPARK_CLIENTS  = [32, 34, 33, 36, 38, 41];
const SPARK_PIPELINE = [420000, 510000, 480000, 560000, 600000, 650000];
const SPARK_DEALS    = [8, 12, 10, 14, 11, 16];
const SPARK_CONV     = [21, 24, 22, 26, 25, 28];
const SPARK_TICKET   = [12400, 13100, 12800, 14200, 13500, 15000];
const SPARK_MONTH_TX = [18, 22, 20, 25, 23, 27];
const SPARK_OVERDUE  = [5, 4, 6, 3, 4, 2];

export function DashboardTab({
  kpis,
  customers,
  opportunities,
  invoices,
  alerts,
  pipelineStages,
  topProducts,
  demoRole,
  onAlertDismiss,
}: DashboardProps) {
  const monthTransactions = invoices.filter((i) => {
    const d = new Date(i.sale_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  return (
    <div className="space-y-4">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard
          label="Ingresos Totales"
          value={kpis.totalRevenue}
          prefix="$"
          change={kpis.totalRevenueChange}
          changeLabel="vs mes ant."
          icon={DollarSign}
          color="#10B981"
          delay={0}
          sparkData={SPARK_REVENUE}
          yoyLabel="+18% vs 2025"
          tooltip="Suma de todas las facturas pagadas en el período seleccionado."
        />
        <KPICard
          label="Clientes Activos"
          value={kpis.activeCustomers}
          change={kpis.activeCustomersChange}
          icon={Users}
          color="#3B82F6"
          delay={0.06}
          sparkData={SPARK_CLIENTS}
          yoyLabel="+12% vs 2025"
          tooltip="Clientes con al menos una transacción en los últimos 90 días."
        />
        <KPICard
          label="Pipeline"
          value={kpis.pipelineValue}
          prefix="$"
          change={kpis.pipelineValueChange}
          changeLabel="crecimiento"
          icon={Target}
          color="#8B5CF6"
          delay={0.12}
          sparkData={SPARK_PIPELINE}
          yoyLabel="+22% vs 2025"
          tooltip="Valor estimado de todos los deals activos en las etapas del embudo comercial."
        />
        <KPICard
          label="Deals Ganados"
          value={kpis.wonDeals}
          change={kpis.wonDealsChange}
          icon={TrendingUp}
          color="#10B981"
          delay={0.18}
          sparkData={SPARK_DEALS}
          yoyLabel="+8% vs 2025"
          tooltip="Deals que pasaron a la etapa de cierre exitoso en el período."
        />
        <KPICard
          label="Tasa Conversión"
          value={kpis.conversionRate}
          suffix="%"
          change={kpis.conversionRateChange}
          icon={CheckCircle2}
          color="#06B6D4"
          delay={0.24}
          sparkData={SPARK_CONV}
          tooltip="Porcentaje de deals que pasan de prospección a venta cerrada."
        />
        <KPICard
          label="Ticket Promedio"
          value={kpis.avgDealSize}
          prefix="$"
          icon={ShoppingCart}
          color="#F59E0B"
          delay={0.30}
          sparkData={SPARK_TICKET}
          tooltip="Valor promedio por factura = Ingresos Totales ÷ Número de facturas."
        />
        <KPICard
          label="Ventas del Mes"
          value={monthTransactions}
          icon={Receipt}
          color="#EC4899"
          delay={0.36}
          sparkData={SPARK_MONTH_TX}
          tooltip="Cantidad de facturas emitidas en el mes calendario actual."
        />
        <KPICard
          label="Facturas Vencidas"
          value={kpis.overdueInvoices}
          icon={AlertTriangle}
          color="#EF4444"
          delay={0.42}
          sparkData={SPARK_OVERDUE}
          tooltip="Facturas cuya fecha de vencimiento ha pasado sin recibir pago."
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueChart invoices={invoices} />
        <MiniPipelineBar stages={pipelineStages} opportunities={opportunities} />
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ConversionFunnel
          stages={pipelineStages}
          opportunities={opportunities}
        />
        <TopCustomers customers={customers} />
        <TopProducts products={topProducts} />
        <ActivityFeed />
      </div>

      {/* Alerts */}
      <AlertsPanel alerts={alerts} onDismiss={onAlertDismiss} />

      {/* Forecast */}
      <ForecastSection
        opportunities={opportunities}
        stages={pipelineStages}
        invoices={invoices}
      />
    </div>
  );
}
