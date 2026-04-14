"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import * as echarts from "echarts/core";
import { FunnelChart } from "echarts/charts";
import {
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { TrendingDown, DollarSign, Target, Percent } from "lucide-react";
import type { SalesPipelineStage, SalesOpportunity } from "../types";

// Register ECharts components (tree-shakeable)
echarts.use([
  FunnelChart,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

// ── Types ─────────────────────────────────────────

type Props = {
  stages: SalesPipelineStage[];
  opportunities: SalesOpportunity[];
};

type StageMetric = {
  stage: SalesPipelineStage;
  count: number;
  amount: number;
  weighted: number;
  conversionFromPrev: number;
};

// ── Funnel Component ──────────────────────────────

export function PipelineFunnel({ stages, opportunities }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  // Compute metrics per stage
  const metrics: StageMetric[] = useMemo(() => {
    const sorted = [...stages]
      .filter((s) => s.is_active)
      .sort((a, b) => a.position - b.position);

    return sorted.map((stage, i) => {
      const stageOpps = opportunities.filter((o) => o.stage_id === stage.id);
      const count = stageOpps.length;
      const amount = stageOpps.reduce((s, o) => s + Number(o.amount), 0);
      const weighted = stageOpps.reduce(
        (s, o) => s + Number(o.amount) * (o.probability / 100),
        0
      );

      // Conversion rate from previous stage
      let conversionFromPrev = 100;
      if (i > 0) {
        const prevCount = opportunities.filter(
          (o) => o.stage_id === sorted[i - 1].id
        ).length;
        conversionFromPrev =
          prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
      }

      return { stage, count, amount, weighted, conversionFromPrev };
    });
  }, [stages, opportunities]);

  // Total pipeline
  const totalPipeline = metrics.reduce((s, m) => s + m.amount, 0);
  const totalWeighted = metrics.reduce((s, m) => s + m.weighted, 0);
  const totalDeals = metrics.reduce((s, m) => s + m.count, 0);

  // Overall conversion (first to last active stage)
  const overallConversion =
    metrics.length >= 2 && metrics[0].count > 0
      ? Math.round(
          (metrics[metrics.length - 1].count / metrics[0].count) * 100
        )
      : 0;

  // ECharts option
  const chartOption = useMemo(() => {
    const maxCount = Math.max(...metrics.map((m) => m.count), 1);

    return {
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(148, 163, 184, 0.2)",
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: "#e2e8f0",
          fontSize: 11,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        },
        formatter: (params: { name: string; value: number; color: string; dataIndex: number }) => {
          const m = metrics[params.dataIndex];
          if (!m) return "";
          return `
            <div style="min-width: 160px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span>
                <span style="font-weight:700;font-size:12px;">${params.name}</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; font-size:10px;">
                <span style="color:#94a3b8;">Deals</span>
                <span style="font-weight:600;text-align:right;">${m.count}</span>
                <span style="color:#94a3b8;">Monto</span>
                <span style="font-weight:600;text-align:right;">$${(m.amount / 1000).toFixed(0)}K</span>
                <span style="color:#94a3b8;">Ponderado</span>
                <span style="font-weight:600;text-align:right;color:#10b981;">$${(m.weighted / 1000).toFixed(0)}K</span>
                <span style="color:#94a3b8;">Conversión</span>
                <span style="font-weight:600;text-align:right;">${m.conversionFromPrev}%</span>
              </div>
            </div>
          `;
        },
      },
      series: [
        {
          name: "Pipeline",
          type: "funnel" as const,
          left: "5%",
          top: 8,
          bottom: 8,
          width: "90%",
          min: 0,
          max: maxCount,
          minSize: "15%",
          maxSize: "100%",
          sort: "descending" as const,
          gap: 3,
          label: {
            show: true,
            position: "inside" as const,
            formatter: (params: { name: string; dataIndex: number }) => {
              const m = metrics[params.dataIndex];
              if (!m) return params.name;
              return `{name|${params.name}}\n{count|${m.count} deals · $${(m.amount / 1000).toFixed(0)}K}`;
            },
            rich: {
              name: {
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                textShadowColor: "rgba(0,0,0,0.3)",
                textShadowBlur: 4,
                lineHeight: 18,
              },
              count: {
                fontSize: 9,
                color: "rgba(255,255,255,0.85)",
                textShadowColor: "rgba(0,0,0,0.2)",
                textShadowBlur: 3,
                lineHeight: 14,
              },
            },
          },
          labelLine: {
            show: false,
          },
          itemStyle: {
            borderColor: "rgba(255,255,255,0.15)",
            borderWidth: 1,
            shadowBlur: 8,
            shadowColor: "rgba(0,0,0,0.1)",
          },
          emphasis: {
            itemStyle: {
              borderColor: "rgba(255,255,255,0.5)",
              borderWidth: 2,
              shadowBlur: 16,
              shadowColor: "rgba(0,0,0,0.2)",
            },
            label: {
              fontSize: 13,
            },
          },
          data: metrics.map((m) => ({
            value: m.count,
            name: m.stage.name,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: m.stage.color },
                { offset: 1, color: adjustBrightness(m.stage.color, 25) },
              ]),
            },
          })),
        },
      ],
    };
  }, [metrics]);

  // Initialize / update ECharts
  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    chartInstance.current.setOption(chartOption, true);

    // Hover events
    chartInstance.current.on("mouseover", (params: { dataIndex?: number }) => {
      if (params.dataIndex !== undefined && metrics[params.dataIndex]) {
        setHoveredStage(metrics[params.dataIndex].stage.id);
      }
    });
    chartInstance.current.on("mouseout", () => {
      setHoveredStage(null);
    });

    // Resize handler
    const obs = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    obs.observe(chartRef.current);

    return () => {
      obs.disconnect();
      chartInstance.current?.off("mouseover");
      chartInstance.current?.off("mouseout");
    };
  }, [chartOption, metrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-[var(--brand)]" />
          <h3 className="text-[11px] font-bold text-[var(--text-primary)]">
            Embudo de Conversión
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <DollarSign size={9} className="text-emerald-500" />
            <span className="text-[9px] text-[var(--text-muted)]">Pipeline</span>
            <span className="text-[10px] font-bold text-[var(--text-primary)] tabular-nums">
              ${(totalPipeline / 1000).toFixed(0)}K
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target size={9} className="text-[var(--brand)]" />
            <span className="text-[9px] text-[var(--text-muted)]">Ponderado</span>
            <span className="text-[10px] font-bold text-emerald-500 tabular-nums">
              ${(totalWeighted / 1000).toFixed(0)}K
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Percent size={9} className="text-amber-500" />
            <span className="text-[9px] text-[var(--text-muted)]">Conversión</span>
            <span className="text-[10px] font-bold text-amber-500 tabular-nums">
              {overallConversion}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Funnel chart */}
        <div className="flex-1 min-h-0">
          <div ref={chartRef} className="w-full h-[220px]" />
        </div>

        {/* Stage breakdown sidebar */}
        <div className="w-[260px] border-l border-[var(--border)] p-3 space-y-1.5 overflow-y-auto">
          {metrics.map((m, i) => (
            <motion.div
              key={m.stage.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-lg px-3 py-2 transition-all duration-200 ${
                hoveredStage === m.stage.id
                  ? "bg-[var(--bg-muted)] ring-1 ring-[var(--brand)]/20"
                  : "bg-transparent hover:bg-[var(--bg-muted)]/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: m.stage.color }}
                />
                <span className="text-[9px] font-semibold text-[var(--text-primary)] flex-1">
                  {m.stage.name}
                </span>
                <span className="text-[9px] font-bold text-[var(--text-primary)] tabular-nums">
                  {m.count}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${totalDeals > 0 ? (m.count / totalDeals) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.8, delay: i * 0.08 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: m.stage.color }}
                  />
                </div>
                <span className="text-[7px] text-[var(--text-muted)] tabular-nums w-8 text-right">
                  ${(m.amount / 1000).toFixed(0)}K
                </span>
              </div>

              {/* Conversion arrow from previous */}
              {i > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[7px] text-[var(--text-muted)]">
                    ↓ {m.conversionFromPrev}% conversión
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + percent);
  const b = Math.min(255, (num & 0xff) + percent);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
