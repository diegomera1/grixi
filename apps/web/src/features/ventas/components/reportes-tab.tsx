"use client";

import { useMemo, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type {
  SalesInvoice,
  SalesCustomer,
  SalesOpportunity,
  SalesQuote,
  SalesActivity,
  DemoRole,
} from "../types";
import { SEGMENT_LABELS, SEGMENT_COLORS, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "../types";
import { fmtMoney, fmtMoneyCompact, fmtNum, fmtPct } from "../utils/fmtMoney";
import { WorldHeatmap } from "./world-heatmap";

type Props = {
  invoices: SalesInvoice[];
  customers: SalesCustomer[];
  opportunities: SalesOpportunity[];
  quotes: SalesQuote[];
  activities?: SalesActivity[];
  demoRole: DemoRole;
};

const CHART_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F97316",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F59E0B",
  "#EF4444",
];

export function ReportesTab({
  invoices,
  customers,
  opportunities,
  quotes,
  activities = [],
  demoRole,
}: Props) {
  // Segment distribution
  const segmentDist = useMemo(() => {
    const segMap: Record<string, number> = {};
    for (const c of customers) {
      segMap[c.segment] = (segMap[c.segment] || 0) + 1;
    }
    return Object.entries(segMap).map(([segment, count]) => ({
      name: SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS] || segment,
      value: count,
      color:
        SEGMENT_COLORS[segment as keyof typeof SEGMENT_COLORS] || "#6B7280",
    }));
  }, [customers]);

  // Revenue by seller
  const revenueBySeller = useMemo(() => {
    const sellerMap: Record<
      string,
      { name: string; revenue: number; deals: number; margin: number }
    > = {};
    for (const inv of invoices) {
      const seller = inv.seller?.full_name || "Sin asignar";
      if (!sellerMap[seller])
        sellerMap[seller] = { name: seller, revenue: 0, deals: 0, margin: 0 };
      sellerMap[seller].revenue += Number(inv.total_usd);
      sellerMap[seller].deals += 1;
      // Estimated margin from items (if available)
      const items = inv.items || [];
      const itemMargin = items.reduce((s, item) => {
        if (item.cost_price && item.subtotal) {
          return (
            s +
            (Number(item.subtotal) -
              Number(item.cost_price) * Number(item.quantity))
          );
        }
        return s;
      }, 0);
      sellerMap[seller].margin +=
        itemMargin > 0 ? itemMargin : Number(inv.total_usd) * 0.35;
    }
    return Object.values(sellerMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [invoices]);

  // Monthly revenue trend
  const monthlyTrend = useMemo(() => {
    const months = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    return months.map((month, i) => {
      const monthInvs = invoices.filter((inv) => {
        const d = new Date(inv.sale_date);
        return d.getMonth() === i && d.getFullYear() === 2026;
      });
      const revenue = monthInvs.reduce(
        (s, inv) => s + Number(inv.total_usd),
        0
      );
      const margin = revenue * 0.35;
      return {
        month,
        revenue,
        margin,
        invoices: monthInvs.length,
      };
    });
  }, [invoices]);

  // Summary cards
  const totalUSD = invoices.reduce(
    (s, inv) => s + Number(inv.total_usd),
    0
  );
  const avgDealSize = invoices.length > 0 ? totalUSD / invoices.length : 0;
  const uniqueCountries = new Set(customers.map((c) => c.country)).size;
  const avgHealthScore =
    customers.length > 0
      ? customers.reduce((s, c) => s + c.health_score, 0) / customers.length
      : 0;

  return (
    <div className="space-y-5">
      {/* Summary cards with hints */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Ingresos Totales USD",
            value: fmtMoneyCompact(totalUSD),
            color: "#10B981",
            sub: `${fmtNum(invoices.length, 0)} facturas`,
            hint: "Suma total de todas las facturas emitidas en USD. Incluye pagadas, pendientes y vencidas.",
          },
          {
            label: "Ticket Promedio",
            value: fmtMoney(avgDealSize, 0),
            color: "#3B82F6",
            sub: "por factura",
            hint: "Valor medio por factura. Se calcula dividiendo los ingresos totales entre el número de facturas emitidas.",
          },
          {
            label: "Países Activos",
            value: String(uniqueCountries),
            color: "#8B5CF6",
            sub: `${customers.length} clientes`,
            hint: "Cantidad de países donde hay al menos un cliente activo con facturación registrada.",
          },
          {
            label: "Health Score",
            value: `${avgHealthScore.toFixed(0)}/100`,
            color: avgHealthScore >= 70 ? "#10B981" : "#F59E0B",
            sub: "promedio clientes",
            hint: "Indicador compuesto de salud del cliente (0-100). Considera NPS, retención, frecuencia de compra y pagos a tiempo.",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="group relative rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {card.label}
            </p>
            <p className="mt-1 text-xl font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {card.sub}
            </p>
            {/* Hint tooltip on hover */}
            <div className="pointer-events-none absolute inset-x-2 -bottom-1 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2.5 text-xs leading-relaxed text-[var(--text-secondary)] shadow-lg">
                {card.hint}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* World Heatmap — Main Feature */}
      <WorldHeatmap invoices={invoices} customers={customers} />

      {/* Revenue Trend + Segment Pie */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly Revenue Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Tendencia de Revenue Mensual (2026)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                  tickFormatter={(v) => fmtMoneyCompact(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 10,
                  }}
                  formatter={(value) => [
                    fmtMoney(Number(value), 0),
                    "Revenue",
                  ]}
                />
                <defs>
                  <linearGradient
                    id="revGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#3B82F6"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#3B82F6"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Segment Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Segmentación de Clientes (RFM)
          </h3>
          <div className="h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segmentDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {segmentDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 10,
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-[var(--text-muted)]">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Bottom section: Seller ranking */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
      >
        <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
          Ranking de Vendedores
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[
                  "#",
                  "Vendedor",
                  "Revenue USD",
                  "Deals",
                  "Ticket Promedio",
                  "Margen Est.",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revenueBySeller.map((seller, i) => {
                const topRevenue = revenueBySeller[0]?.revenue || 1;
                const pct = (seller.revenue / topRevenue) * 100;
                return (
                  <tr
                    key={seller.name}
                    className="border-b border-[var(--border)] last:border-0 group"
                  >
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "text-[13px] font-bold",
                          i === 0
                            ? "text-[#F59E0B]"
                            : i === 1
                              ? "text-[#94A3B8]"
                              : i === 2
                                ? "text-[#CD7F32]"
                                : "text-[var(--text-muted)]"
                        )}
                      >
                        #{i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">
                        {seller.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-emerald-500 tabular-nums">
                          {fmtMoney(seller.revenue, 0)}
                        </span>
                        <div className="hidden sm:block h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                        {seller.deals}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                        {fmtMoney(seller.revenue / seller.deals, 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[13px] font-medium text-emerald-500 tabular-nums">
                        {seller.revenue > 0
                          ? (
                              (seller.margin / seller.revenue) *
                              100
                            ).toFixed(0)
                          : 0}
                        %
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Payment Analysis ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Análisis de Pagos
          </h3>
          <div className="space-y-2">
            {(() => {
              const statusMap: Record<string, { label: string; color: string; count: number; total: number }> = {};
              for (const inv of invoices) {
                if (!statusMap[inv.status]) statusMap[inv.status] = { label: inv.status, color: '#6B7280', count: 0, total: 0 };
                statusMap[inv.status].count += 1;
                statusMap[inv.status].total += Number(inv.total_usd);
              }
              const colors: Record<string, string> = { paid: '#10B981', invoiced: '#3B82F6', overdue: '#EF4444', partially_paid: '#F97316', confirmed: '#8B5CF6', draft: '#6B7280', cancelled: '#475569' };
              const labels: Record<string, string> = { paid: 'Pagadas', invoiced: 'Facturadas', overdue: 'Vencidas', partially_paid: 'Parcial', confirmed: 'Confirmadas', draft: 'Borrador', cancelled: 'Canceladas' };
              const totalInv = invoices.length;
              return Object.entries(statusMap).sort((a, b) => b[1].count - a[1].count).map(([status, data]) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colors[status] || '#6B7280' }} />
                  <span className="w-20 text-xs text-[var(--text-muted)]">{labels[status] || status}</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(data.count / totalInv) * 100}%`, backgroundColor: colors[status] || '#6B7280' }} />
                  </div>
                  <span className="text-xs font-bold text-[var(--text-secondary)] tabular-nums w-8 text-right">{data.count}</span>
                  <span className="text-xs font-bold text-emerald-500 tabular-nums w-16 text-right">{fmtMoneyCompact(data.total)}</span>
                </div>
              ));
            })()}
          </div>
          <div className="mt-3 pt-2 border-t border-[var(--border)] flex justify-between text-sm text-[var(--text-muted)]">
            <span>Total: {fmtNum(invoices.length, 0)} facturas</span>
            <span className="font-bold text-[var(--text-primary)]">{fmtMoney(totalUSD, 0)}</span>
          </div>
        </motion.div>

        {/* Customer Health by Segment */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Salud de Clientes por Segmento
          </h3>
          <div className="space-y-2">
            {(() => {
              const segments = ['champion', 'loyal', 'new', 'at_risk', 'dormant', 'prospect'] as const;
              return segments.map((seg) => {
                const segs = customers.filter((c) => c.segment === seg);
                if (segs.length === 0) return null;
                const avgHealth = segs.reduce((s, c) => s + c.health_score, 0) / segs.length;
                const avgRev = segs.reduce((s, c) => s + c.total_revenue, 0) / segs.length;
                const avgNps = segs.reduce((s, c) => s + c.nps_score, 0) / segs.length;
                return (
                  <div key={seg} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--bg-muted)] transition-colors">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: SEGMENT_COLORS[seg] }} />
                    <div className="w-16">
                      <span className="text-xs font-semibold" style={{ color: SEGMENT_COLORS[seg] }}>{SEGMENT_LABELS[seg]}</span>
                    </div>
                    <span className="text-sm text-[var(--text-muted)] w-6 text-center">{segs.length}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="h-1.5 w-full rounded-full bg-[var(--bg-muted)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${avgHealth}%`, backgroundColor: avgHealth > 70 ? '#10B981' : avgHealth > 45 ? '#F59E0B' : '#EF4444' }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color: avgHealth > 70 ? '#10B981' : avgHealth > 45 ? '#F59E0B' : '#EF4444' }}>{avgHealth.toFixed(0)}</span>
                    <span className="text-sm text-[var(--text-muted)] tabular-nums w-12 text-right">NPS {avgNps.toFixed(0)}</span>
                    <span className="text-sm font-bold text-[var(--text-secondary)] tabular-nums w-14 text-right">{fmtMoneyCompact(avgRev)}</span>
                  </div>
                );
              }).filter(Boolean);
            })()}
          </div>
        </motion.div>
      </div>

      {/* ── Customer Retention + Activity by Type ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Retention by Segment */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Retención y Crecimiento por Segmento
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const segments = ['champion', 'loyal', 'new', 'at_risk'] as const;
                return segments.map((seg) => {
                  const segs = customers.filter((c) => c.segment === seg);
                  if (segs.length === 0) return { name: SEGMENT_LABELS[seg], retention: 0, growth: 0 };
                  return {
                    name: SEGMENT_LABELS[seg],
                    retention: +(segs.reduce((s, c) => s + c.retention_rate, 0) / segs.length).toFixed(1),
                    growth: +(segs.reduce((s, c) => s + c.yoy_growth_pct, 0) / segs.length).toFixed(1),
                    color: SEGMENT_COLORS[seg],
                  };
                });
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 10 }} formatter={(value) => [`${value}%`]} />
                <Bar dataKey="retention" name="Retención %" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="growth" name="Crecimiento YoY %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => <span className="text-xs text-[var(--text-muted)]">{value}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Activity Types */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Actividades Comerciales por Tipo
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const actMap: Record<string, number> = {};
                for (const a of activities) {
                  actMap[a.activity_type] = (actMap[a.activity_type] || 0) + 1;
                }
                return Object.entries(actMap)
                  .map(([type, count]) => ({
                    name: ACTIVITY_TYPE_LABELS[type as keyof typeof ACTIVITY_TYPE_LABELS] || type,
                    count,
                    color: ACTIVITY_TYPE_COLORS[type as keyof typeof ACTIVITY_TYPE_COLORS] || '#6B7280',
                  }))
                  .sort((a, b) => b.count - a.count);
              })()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 10 }} />
                <Bar dataKey="count" name="Cantidad" radius={[0, 4, 4, 0]}>
                  {(() => {
                    const actMap: Record<string, number> = {};
                    for (const a of activities) actMap[a.activity_type] = (actMap[a.activity_type] || 0) + 1;
                    return Object.entries(actMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type]) => (
                        <Cell key={type} fill={ACTIVITY_TYPE_COLORS[type as keyof typeof ACTIVITY_TYPE_COLORS] || '#6B7280'} />
                      ));
                  })()}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-sm text-[var(--text-muted)] text-center">
            Total: {fmtNum(activities.length, 0)} actividades registradas
          </div>
        </motion.div>
      </div>

      {/* ── Opportunity Pipeline + Top Products ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Opportunity funnel by source */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Oportunidades por Fuente
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(() => {
                    const srcMap: Record<string, { count: number; amount: number }> = {};
                    for (const o of opportunities) {
                      const src = o.source || 'other';
                      if (!srcMap[src]) srcMap[src] = { count: 0, amount: 0 };
                      srcMap[src].count += 1;
                      srcMap[src].amount += Number(o.amount);
                    }
                    const labels: Record<string, string> = { referral: 'Referido', website: 'Web', cold_call: 'Llamada', event: 'Evento', inbound: 'Entrante', partner: 'Partner', other: 'Otro' };
                    return Object.entries(srcMap).map(([src, data], i) => ({
                      name: labels[src] || src,
                      value: data.count,
                      amount: data.amount,
                    }));
                  })()}
                  cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value"
                >
                  {(() => {
                    const srcMap: Record<string, number> = {};
                    for (const o of opportunities) {
                      const src = o.source || 'other';
                      srcMap[src] = (srcMap[src] || 0) + 1;
                    }
                    return Object.keys(srcMap).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ));
                  })()}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 10 }} />
                <Legend formatter={(value) => <span className="text-xs text-[var(--text-muted)]">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 text-center text-sm text-[var(--text-muted)]">
            {fmtNum(opportunities.length, 0)} oportunidades · {fmtMoney(opportunities.reduce((s, o) => s + Number(o.amount), 0), 0)} en pipeline
          </div>
        </motion.div>

        {/* Product Mix from Invoice Items */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Top Productos por Facturación
          </h3>
          <div className="space-y-2">
            {(() => {
              const prodMap: Record<string, { revenue: number; qty: number; count: number }> = {};
              for (const inv of invoices) {
                for (const item of (inv.items || [])) {
                  const name = item.description.split(' ').slice(0, 3).join(' ');
                  if (!prodMap[name]) prodMap[name] = { revenue: 0, qty: 0, count: 0 };
                  prodMap[name].revenue += Number(item.subtotal || 0);
                  prodMap[name].qty += Number(item.quantity);
                  prodMap[name].count += 1;
                }
              }
              const top = Object.entries(prodMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
              const maxRev = top[0]?.[1].revenue || 1;
              return top.map(([name, data], i) => (
                <div key={name} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--bg-muted)] transition-colors">
                  <span className="text-sm font-bold text-[var(--text-muted)] w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">{name}</p>
                    <div className="mt-0.5 h-1 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(data.revenue / maxRev) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-500 tabular-nums">{fmtMoneyCompact(data.revenue)}</p>
                    <p className="text-[13px] text-[var(--text-muted)]">{fmtNum(data.qty, 0)} uds · {data.count} fact</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
