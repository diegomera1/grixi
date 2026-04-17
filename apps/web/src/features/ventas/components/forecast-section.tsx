"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  Clock,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import type {
  SalesOpportunity,
  SalesPipelineStage,
  SalesInvoice,
} from "../types";

type Props = {
  opportunities: SalesOpportunity[];
  stages: SalesPipelineStage[];
  invoices: SalesInvoice[];
};

export function ForecastSection({ opportunities, stages, invoices }: Props) {
  // ── Weighted Pipeline Forecast ──────────────────
  const pipelineForecast = useMemo(() => {
    const activeOpps = opportunities.filter((o) => {
      const stage = stages.find((s) => s.id === o.stage_id);
      return stage && !stage.is_won && !stage.is_lost;
    });

    const stageData = stages
      .filter((s) => !s.is_won && !s.is_lost)
      .sort((a, b) => a.position - b.position)
      .map((stage) => {
        const stageOpps = activeOpps.filter((o) => o.stage_id === stage.id);
        const rawAmount = stageOpps.reduce((s, o) => s + Number(o.amount), 0);
        const weighted = stageOpps.reduce(
          (s, o) => s + Number(o.amount) * (o.probability / 100),
          0
        );
        return {
          name: stage.name,
          raw: rawAmount,
          weighted,
          color: stage.color,
          count: stageOpps.length,
        };
      });

    const totalWeighted = stageData.reduce((s, d) => s + d.weighted, 0);
    const totalRaw = stageData.reduce((s, d) => s + d.raw, 0);

    return { stageData, totalWeighted, totalRaw };
  }, [opportunities, stages]);

  // ── Historical Trend + Projection ───────────────
  const trendData = useMemo(() => {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
    const historical = months.map((month, i) => {
      const monthInv = invoices.filter((inv) => {
        const d = new Date(inv.sale_date);
        return d.getMonth() === i && d.getFullYear() === 2026;
      });
      return {
        month,
        revenue: monthInv.reduce((s, inv) => s + Number(inv.total_usd), 0),
        projected: null as number | null,
      };
    });

    // Simple linear regression for projection
    const revenueValues = historical.map((h) => h.revenue).filter((v) => v > 0);
    const n = revenueValues.length;
    if (n >= 2) {
      const sumX = revenueValues.reduce((s, _, i) => s + i, 0);
      const sumY = revenueValues.reduce((s, v) => s + v, 0);
      const sumXY = revenueValues.reduce((s, v, i) => s + i * v, 0);
      const sumX2 = revenueValues.reduce((s, _, i) => s + i * i, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Project 3 months forward
      const projMonths = ["Jul", "Ago", "Sep"];
      for (let j = 0; j < 3; j++) {
        historical.push({
          month: projMonths[j],
          revenue: 0,
          projected: Math.max(0, Math.round(intercept + slope * (n + j))),
        });
      }

      // Add projected line to last historical month
      if (historical[n - 1]) {
        historical[n - 1].projected = historical[n - 1].revenue;
      }
    }

    return historical;
  }, [invoices]);

  // ── Velocity (average days to close) ────────────
  const avgVelocity = useMemo(() => {
    const wonOpps = opportunities.filter((o) => {
      const stage = stages.find((s) => s.id === o.stage_id);
      return stage?.is_won && o.actual_close_date;
    });
    if (wonOpps.length === 0) return 0;
    const totalDays = wonOpps.reduce((s, o) => {
      const created = new Date(o.created_at).getTime();
      const closed = new Date(o.actual_close_date!).getTime();
      return s + Math.max(1, (closed - created) / 86400000);
    }, 0);
    return Math.round(totalDays / wonOpps.length);
  }, [opportunities, stages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="space-y-4"
    >
      {/* Forecast KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
          <Zap size={16} className="mx-auto mb-1 text-amber-500" />
          <p className="text-lg font-bold text-[var(--text-primary)]">
            ${(pipelineForecast.totalWeighted / 1000).toFixed(0)}K
          </p>
          <p className="text-sm text-[var(--text-muted)]">Forecast Ponderado</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
          <Target size={16} className="mx-auto mb-1 text-[#3B82F6]" />
          <p className="text-lg font-bold text-[var(--text-primary)]">
            ${(pipelineForecast.totalRaw / 1000).toFixed(0)}K
          </p>
          <p className="text-sm text-[var(--text-muted)]">Pipeline Total</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
          <Clock size={16} className="mx-auto mb-1 text-violet-500" />
          <p className="text-lg font-bold text-[var(--text-primary)]">
            {avgVelocity || "—"}
          </p>
          <p className="text-sm text-[var(--text-muted)]">Días Promedio Cierre</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weighted Pipeline Bars */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">
            Pipeline Ponderado por Etapa
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pipelineForecast.stageData}
                layout="vertical"
                margin={{ left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 8, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 8, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 10,
                  }}
                  formatter={(value, name) => [
                    `$${Number(value).toLocaleString()}`,
                    name === "weighted" ? "Ponderado" : "Bruto",
                  ]}
                />
                <Bar dataKey="weighted" radius={[0, 4, 4, 0]} barSize={14}>
                  {pipelineForecast.stageData.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historical Trend + Projection */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
              Tendencia + Proyección
            </h4>
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-4 rounded bg-[#3B82F6]" />
                <span className="text-[13px] text-[var(--text-muted)]">Actual</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-4 rounded bg-[#10B981]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 2px, var(--bg-card) 2px, var(--bg-card) 4px)" }} />
                <span className="text-[13px] text-[var(--text-muted)]">Proyección</span>
              </div>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 8, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 8, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 10,
                  }}
                  formatter={(value, name) => [
                    `$${Number(value).toLocaleString()}`,
                    name === "revenue" ? "Revenue" : "Proyección",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#forecastGrad)"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ fill: "#10B981", r: 3 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
