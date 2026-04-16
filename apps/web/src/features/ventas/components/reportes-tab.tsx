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
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type {
  SalesInvoice,
  SalesCustomer,
  SalesOpportunity,
  SalesQuote,
  DemoRole,
} from "../types";
import { SEGMENT_LABELS, SEGMENT_COLORS } from "../types";
import { WorldHeatmap } from "./world-heatmap";

type Props = {
  invoices: SalesInvoice[];
  customers: SalesCustomer[];
  opportunities: SalesOpportunity[];
  quotes: SalesQuote[];
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
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Ingresos Totales USD",
            value: `$${(totalUSD / 1000).toFixed(0)}K`,
            color: "#10B981",
            sub: `${invoices.length} facturas`,
          },
          {
            label: "Ticket Promedio",
            value: `$${(avgDealSize / 1000).toFixed(1)}K`,
            color: "#3B82F6",
            sub: "por factura",
          },
          {
            label: "Países Activos",
            value: String(uniqueCountries),
            color: "#8B5CF6",
            sub: `${customers.length} clientes`,
          },
          {
            label: "Health Score",
            value: `${avgHealthScore.toFixed(0)}/100`,
            color: avgHealthScore >= 70 ? "#10B981" : "#F59E0B",
            sub: "promedio clientes",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              {card.label}
            </p>
            <p className="mt-1 text-lg font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="mt-0.5 text-[8px] text-[var(--text-muted)]">
              {card.sub}
            </p>
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
          <h3 className="mb-3 text-[11px] font-semibold text-[var(--text-primary)]">
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
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 10,
                  }}
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
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
          <h3 className="mb-3 text-[11px] font-semibold text-[var(--text-primary)]">
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
                    <span className="text-[9px] text-[var(--text-muted)]">
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
        <h3 className="mb-3 text-[11px] font-semibold text-[var(--text-primary)]">
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
                    className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
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
                          "text-[10px] font-bold",
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
                      <span className="text-[10px] font-medium text-[var(--text-primary)]">
                        {seller.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-500 tabular-nums">
                          ${(seller.revenue / 1000).toFixed(1)}K
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
                      <span className="text-[10px] text-[var(--text-secondary)] tabular-nums">
                        {seller.deals}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] text-[var(--text-secondary)] tabular-nums">
                        ${(seller.revenue / seller.deals / 1000).toFixed(1)}K
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-medium text-emerald-500 tabular-nums">
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
    </div>
  );
}
