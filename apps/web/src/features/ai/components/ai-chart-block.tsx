"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3, Maximize2, Minimize2, X } from "lucide-react";

// Chart configuration type the AI generates
export type ChartConfig = {
  type: "bar" | "line" | "pie" | "area";
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKeys?: { key: string; label: string; color: string }[];
  colors?: string[];
};

const DEFAULT_COLORS = [
  "#7C3AED",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#F43F5E",
  "#8B5CF6",
  "#F97316",
  "#EC4899",
];

const tooltipStyle = {
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  fontSize: "11px",
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

const fullscreenTooltipStyle = {
  ...tooltipStyle,
  fontSize: "13px",
  padding: "10px 16px",
};

/** Renders the chart content — shared between inline and fullscreen */
function ChartContent({
  type,
  data,
  resolvedX,
  resolvedKeys,
  chartColors,
  fullscreen = false,
}: {
  type: ChartConfig["type"];
  data: ChartConfig["data"];
  resolvedX: string;
  resolvedKeys: { key: string; label: string; color: string }[];
  chartColors: string[];
  fullscreen?: boolean;
}) {
  const fontSize = fullscreen ? 12 : 10;
  const legendFontSize = fullscreen ? "13px" : "11px";
  const ts = fullscreen ? fullscreenTooltipStyle : tooltipStyle;

  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === "bar" ? (
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey={resolvedX} tick={{ fontSize, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={{ fontSize, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} />
          <Tooltip contentStyle={ts} />
          <Legend wrapperStyle={{ fontSize: legendFontSize }} />
          {resolvedKeys.map((k) => (
            <Bar key={k.key} dataKey={k.key} name={k.label} fill={k.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      ) : type === "line" ? (
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey={resolvedX} tick={{ fontSize, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={{ fontSize, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} />
          <Tooltip contentStyle={ts} />
          <Legend wrapperStyle={{ fontSize: legendFontSize }} />
          {resolvedKeys.map((k) => (
            <Line key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={k.color} strokeWidth={2} dot={{ r: 3, fill: k.color }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      ) : type === "area" ? (
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey={resolvedX} tick={{ fontSize, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={{ fontSize, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} />
          <Tooltip contentStyle={ts} />
          <Legend wrapperStyle={{ fontSize: legendFontSize }} />
          {resolvedKeys.map((k) => (
            <Area key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={k.color} fill={k.color} fillOpacity={0.15} strokeWidth={2} />
          ))}
        </AreaChart>
      ) : (
        <PieChart>
          <Pie
            data={data}
            dataKey={resolvedKeys[0]?.key || "value"}
            nameKey={resolvedX}
            cx="50%"
            cy="50%"
            outerRadius={fullscreen ? 180 : 80}
            innerRadius={fullscreen ? 80 : 40}
            paddingAngle={2}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={chartColors[i % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={ts} />
          <Legend wrapperStyle={{ fontSize: legendFontSize }} />
        </PieChart>
      )}
    </ResponsiveContainer>
  );
}

export function AiChartBlock({ config }: { config: ChartConfig }) {
  const { type, title, description, data, xKey, yKeys, colors } = config;
  const chartColors = colors || DEFAULT_COLORS;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  // Auto-detect keys if not provided
  const resolvedKeys = useMemo(() => {
    if (yKeys && yKeys.length > 0) return yKeys;
    if (data.length === 0) return [];
    const allKeys = Object.keys(data[0]);
    const numericKeys = allKeys.filter(
      (k) => k !== xKey && typeof data[0][k] === "number"
    );
    return numericKeys.map((k, i) => ({
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
      color: chartColors[i % chartColors.length],
    }));
  }, [data, xKey, yKeys, chartColors]);

  const resolvedX = xKey || (data.length > 0 ? Object.keys(data[0])[0] : "name");

  return (
    <>
      <div className="my-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand)]/10">
              <BarChart3 size={14} className="text-[var(--brand)]" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">{title}</h4>
              {description && (
                <p className="text-[10px] text-[var(--text-muted)]">{description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsFullscreen(true)}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            title="Pantalla completa"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Inline Chart */}
        <div className="h-64 w-full">
          <ChartContent
            type={type}
            data={data}
            resolvedX={resolvedX}
            resolvedKeys={resolvedKeys}
            chartColors={chartColors}
          />
        </div>
      </div>

      {/* Fullscreen modal overlay via portal */}
      {isFullscreen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-[var(--bg-primary)]">
            {/* Fullscreen header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)]/10">
                  <BarChart3 size={18} className="text-[var(--brand)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
                  {description && (
                    <p className="text-xs text-[var(--text-muted)]">{description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              >
                <Minimize2 size={14} />
                Salir
              </button>
            </div>

            {/* Fullscreen chart */}
            <div className="flex-1 p-6">
              <ChartContent
                type={type}
                data={data}
                resolvedX={resolvedX}
                resolvedKeys={resolvedKeys}
                chartColors={chartColors}
                fullscreen
              />
            </div>
          </div>,
          document.body
        )
      }
    </>
  );
}

/** Parse chart blocks from AI response text */
export function parseChartBlocks(content: string): {
  cleanContent: string;
  charts: ChartConfig[];
} {
  const charts: ChartConfig[] = [];
  const chartRegex = /<!--CHART:([\s\S]*?)-->/g;

  const cleanContent = content.replace(chartRegex, (_, json) => {
    try {
      const config = JSON.parse(json.trim()) as ChartConfig;
      charts.push(config);
      return `\n\n[📊 Gráfico: ${config.title}]\n\n`;
    } catch {
      return "";
    }
  });

  return { cleanContent, charts };
}

/** Parse image blocks from AI response text */
export function parseImageBlocks(content: string): {
  cleanContent: string;
  imagePrompts: string[];
} {
  const imagePrompts: string[] = [];
  const imageRegex = /<!--IMAGE:([\s\S]*?)-->/g;

  const cleanContent = content.replace(imageRegex, (_, prompt) => {
    imagePrompts.push(prompt.trim());
    return `\n\n[🖼️ Generando imagen...]\n\n`;
  });

  return { cleanContent, imagePrompts };
}
