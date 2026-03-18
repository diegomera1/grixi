"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, AlertTriangle, TrendingUp, Zap, CheckCircle2,
  ChevronRight, Activity, RefreshCw, Sparkles, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Equipment, WorkOrder, KPISnapshot } from "../types";
import { analyzeFleetPredictive } from "../actions/ai-fleet-action";
import type { AIAnalysisResult, PredictiveInsight, TrendAnomaly, MaintenanceOptimization } from "../actions/ai-fleet-action";

// ── Risk Color Map ──────────────────────────────

const RISK_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#10B981",
};

const RISK_LABELS: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

// ── AI Tab Component ────────────────────────────

export function AITab({ equipment, workOrders, kpis }: {
  equipment: Equipment[];
  workOrders: WorkOrder[];
  kpis: KPISnapshot[];
}) {
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPred, setExpandedPred] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeFleetPredictive(equipment, workOrders, kpis);
      setResult(data);
      if (!data.predictions.length && !data.anomalies.length) {
        setError(data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al analizar");
    } finally {
      setLoading(false);
    }
  }, [equipment, workOrders, kpis]);

  // Auto-analyze on mount
  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const totalSavings = result?.optimizations?.reduce((sum, o) => sum + (o.savings_estimate || 0), 0) || 0;

  return (
    <div className="space-y-4">
      {/* AI Header */}
      <div className="rounded-xl border border-[#8B5CF6]/20 bg-gradient-to-r from-[#8B5CF6]/5 to-[#0EA5E9]/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20">
            {loading ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <Cpu size={18} className="text-white" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">GRIXI AI — Análisis Predictivo</h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              {loading
                ? "Analizando datos con Gemini..."
                : result
                  ? `${result.predictions?.length || 0} predicciones · ${result.anomalies?.length || 0} anomalías · ${result.optimizations?.length || 0} optimizaciones`
                  : "Powered by Gemini"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {result?.generated_at && !loading && (
              <span className="hidden sm:flex items-center gap-1 rounded-full bg-[#8B5CF6]/10 px-2.5 py-0.5 text-[9px] font-bold text-[#8B5CF6]">
                <Sparkles size={10} />
                {new Date(result.generated_at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all",
                loading
                  ? "bg-[#8B5CF6]/10 text-[#8B5CF6]/50 cursor-wait"
                  : "bg-[#8B5CF6] text-white hover:bg-[#8B5CF6]/80"
              )}
            >
              <RefreshCw size={10} className={cn(loading && "animate-spin")} />
              {loading ? "Analizando..." : "Re-analizar"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {result?.summary && !error && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#0EA5E9]/20 bg-[#0EA5E9]/5 px-4 py-3"
        >
          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
            <Sparkles size={12} className="inline-block mr-1.5 text-[#0EA5E9]" />
            {result.summary}
          </p>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-xs text-red-500">
            <AlertTriangle size={12} className="inline-block mr-1.5" />
            {error}
          </p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 animate-pulse">
              <div className="h-3 w-32 rounded bg-[var(--bg-muted)] mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-10 rounded-lg bg-[var(--bg-muted)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && result && (result.predictions?.length > 0 || result.anomalies?.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Predictive Failures */}
          {result.predictions?.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <Activity size={12} />
                Predicción de Fallas ({result.predictions.length})
              </h3>
              <div className="space-y-1.5">
                {result.predictions.map((pred, i) => (
                  <PredictionRow
                    key={`${pred.equipment_code}-${i}`}
                    pred={pred}
                    index={i}
                    expanded={expandedPred === `${pred.equipment_code}-${i}`}
                    onToggle={() => setExpandedPred(
                      expandedPred === `${pred.equipment_code}-${i}` ? null : `${pred.equipment_code}-${i}`
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Right Column */}
          <div className="space-y-4">
            {/* Trend Anomalies */}
            {result.anomalies?.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <TrendingUp size={12} />
                  Anomalías en Tendencias ({result.anomalies.length})
                </h3>
                <div className="space-y-1.5">
                  {result.anomalies.map((a, i) => (
                    <AnomalyRow key={`${a.kpi}-${i}`} anomaly={a} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Optimization Suggestions */}
            {result.optimizations?.length > 0 && (
              <div className="rounded-xl border border-[#10B981]/20 bg-[#10B981]/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#10B981]">
                    <Zap size={12} />
                    Optimizaciones ({result.optimizations.length})
                  </h3>
                  {totalSavings > 0 && (
                    <span className="text-xs font-bold text-[#10B981]">
                      Ahorro est. ${totalSavings.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {result.optimizations.map((opt, i) => (
                    <OptimizationRow key={`${opt.title}-${i}`} opt={opt} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────

function PredictionRow({ pred, index, expanded, onToggle }: {
  pred: PredictiveInsight;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const riskColor = RISK_COLORS[pred.risk_level] || "#6B7280";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: riskColor }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{pred.equipment_name}</p>
          <p className="text-[9px] text-[#0EA5E9] font-mono">{pred.equipment_code}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold" style={{ color: riskColor }}>
            {pred.predicted_failure_days}d
          </p>
          <p className="text-[8px] text-[var(--text-muted)]">
            {typeof pred.confidence === "number" ? `${(pred.confidence * 100).toFixed(0)}%` : "—"} conf.
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span
            className="rounded-full px-1.5 py-0.5 text-[7px] font-bold"
            style={{ backgroundColor: `${riskColor}15`, color: riskColor }}
          >
            {RISK_LABELS[pred.risk_level] || pred.risk_level}
          </span>
          <ChevronRight size={12} className={cn("text-[var(--text-muted)] transition-transform", expanded && "rotate-90")} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)] px-3 py-2.5 bg-[var(--bg-muted)]/20">
              {pred.reasoning && (
                <p className="text-[10px] text-[var(--text-secondary)] mb-1.5 leading-relaxed">{pred.reasoning}</p>
              )}
              {pred.recommendation && (
                <div className="flex items-start gap-1.5 rounded-md bg-[#0EA5E9]/5 px-2 py-1.5">
                  <CheckCircle2 size={10} className="text-[#0EA5E9] mt-0.5 shrink-0" />
                  <p className="text-[10px] text-[#0EA5E9] font-medium">{pred.recommendation}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Format raw KPI field names to readable Spanish labels
const KPI_LABELS: Record<string, string> = {
  maintenance_cost: "Costo de Mantenimiento",
  fuel_consumption: "Consumo de Combustible",
  engine_temperature: "Temperatura del Motor",
  operating_hours: "Horas de Operación",
  mtbf: "Tiempo Medio Entre Fallas",
  mttr: "Tiempo de Reparación",
  availability: "Disponibilidad",
  reliability: "Confiabilidad",
  vibration_level: "Nivel de Vibración",
  oil_pressure: "Presión de Aceite",
  coolant_temp: "Temperatura del Refrigerante",
  rpm: "RPM",
  power_output: "Potencia de Salida",
  exhaust_temp: "Temperatura de Escape",
};

function formatKpiLabel(raw: string): string {
  if (KPI_LABELS[raw]) return KPI_LABELS[raw];
  // Fallback: convert snake_case to Title Case
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AnomalyRow({ anomaly, index }: { anomaly: TrendAnomaly; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-2.5 rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2.5"
    >
      {anomaly.severity === "warning" ? (
        <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
      ) : (
        <TrendingUp size={13} className="text-green-500 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{formatKpiLabel(anomaly.kpi)}</p>
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[7px] font-bold shrink-0",
            anomaly.direction === "deteriorating"
              ? "bg-red-500/10 text-red-500"
              : "bg-green-500/10 text-green-500"
          )}>
            {anomaly.direction === "deteriorating" ? "↓ Deterioro" : "↑ Mejora"}
          </span>
        </div>
        <p className="text-[9px] text-[var(--text-muted)] mt-1 leading-relaxed">{anomaly.detail}</p>
      </div>
    </motion.div>
  );
}

function OptimizationRow({ opt, index }: { opt: MaintenanceOptimization; index: number }) {
  const typeIcons: Record<string, string> = {
    schedule: "📅",
    inventory: "📦",
    crew: "👥",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-lg bg-[var(--bg-surface)] px-3 py-2.5"
    >
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">
          {typeIcons[opt.type] || "⚡"} {opt.title}
        </p>
        {opt.savings_estimate > 0 && (
          <span className="text-xs font-bold text-[#10B981]">+${opt.savings_estimate.toLocaleString()}</span>
        )}
      </div>
      <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">{opt.detail}</p>
    </motion.div>
  );
}
