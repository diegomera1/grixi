"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu, AlertTriangle, TrendingUp, Zap, CheckCircle2,
  ChevronRight, Clock, Activity,
} from "lucide-react";
import type { Equipment, WorkOrder, KPISnapshot } from "../types";
import { EQUIPMENT_STATUS_COLORS, EQUIPMENT_CRITICALITY_COLORS } from "../types";

// ── AI Analysis Types ───────────────────────────

type PredictiveInsight = {
  id: string;
  equipment_code: string;
  equipment_name: string;
  risk_level: "critical" | "high" | "medium" | "low";
  predicted_failure_days: number;
  confidence: number;
  recommendation: string;
  reasoning: string;
};

type TrendAnomaly = {
  id: string;
  kpi: string;
  direction: "deteriorating" | "improving";
  detail: string;
  severity: "warning" | "info";
};

type MaintenanceOptimization = {
  id: string;
  title: string;
  savings_estimate: number;
  detail: string;
  type: "schedule" | "inventory" | "crew";
};

// ── Demo AI Predictions ─────────────────────────

function generatePredictions(equipment: Equipment[]): PredictiveInsight[] {
  const critical = equipment.filter((e) => e.criticality === "critical" || e.criticality === "high");
  return critical.slice(0, 6).map((eq, i) => {
    const risks: PredictiveInsight["risk_level"][] = ["low", "medium", "high", "critical", "medium", "low"];
    const days = [120, 45, 15, 7, 60, 90];
    const confs = [0.78, 0.85, 0.92, 0.96, 0.82, 0.71];
    const recs = [
      "Programar inspección preventiva en próximo puerto",
      "Solicitar repuestos para overhaul — lead time 30 días",
      "Reducir carga operativa al 80% — monitorear cada 4 horas",
      "Mantenimiento correctivo urgente requerido — despatch crew",
      "Incluir en próximo plan de mantenimiento trimestral",
      "Mantener monitoreo estándar — sin acción inmediata",
    ];
    const reasons = [
      "Patrón de vibración incremental detectado en últimas 200h de operación. Modelo predictivo basado en datos históricos similares del equipo.",
      "Temperatura de operación 8% superior al baseline de los últimos 6 meses. Correlación con falla de empaquetaduras en equipos similares.",
      "Presión diferencial aumentando progresivamente. El modelo detecta patrón similar a falla reportada en WO-2025-087.",
      "Múltiples indicadores fuera de rango nominal simultáneamente. Probabilidad de falla compuesta basada en análisis bayesiano.",
      "Horas de operación acercándose al intervalo de overhaul recomendado por fabricante (12,000h).",
      "Lecturas estables dentro de parámetros. Modelo ML no detecta anomalías significativas.",
    ];
    return {
      id: `pred-${i}`,
      equipment_code: eq.code,
      equipment_name: eq.name,
      risk_level: risks[i],
      predicted_failure_days: days[i],
      confidence: confs[i],
      recommendation: recs[i],
      reasoning: reasons[i],
    };
  });
}

function generateAnomalies(kpis: KPISnapshot[]): TrendAnomaly[] {
  return [
    { id: "a1", kpi: "MTBF", direction: "deteriorating", detail: "MTBF bajó 12% en últimos 2 meses — posible degradación de programa preventivo", severity: "warning" },
    { id: "a2", kpi: "Disponibilidad", direction: "improving", detail: "Disponibilidad mejoró de 94.8% a 96.2% — resultado de overhauls Cyl 3 y 5", severity: "info" },
    { id: "a3", kpi: "Costo Mtto", direction: "deteriorating", detail: "Costo de mantenimiento aumentó 23% vs. trimestre anterior — revisar eficiencia de proveedores", severity: "warning" },
    { id: "a4", kpi: "WOs Atrasadas", direction: "deteriorating", detail: "3 WOs superaron fecha planificada — reasignar recursos de tripulación", severity: "warning" },
  ];
}

function generateOptimizations(): MaintenanceOptimization[] {
  return [
    { id: "o1", title: "Consolidar OTs de Sala de Máquinas", savings_estimate: 4500, detail: "WO-001, WO-003 y WO-008 pueden ejecutarse en paralelo durante próxima parada — ahorro en mano de obra y downtime", type: "schedule" },
    { id: "o2", title: "Compra anticipada de repuestos críticos", savings_estimate: 8200, detail: "5 repuestos con lead time >30d tienen stock bajo. Compra consolidada reduce costos de envío urgente al buque", type: "inventory" },
    { id: "o3", title: "Redistribución de turnos de inspección", savings_estimate: 2100, detail: "Optimizar rondas de inspección del Chief Engineer: de 4h a 2.5h con ruta eficiente", type: "crew" },
  ];
}

// ── Risk Color Map ──────────────────────────────

const RISK_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#10B981",
};

// ── AI Tab Component ────────────────────────────

export function AITab({ equipment, workOrders, kpis }: {
  equipment: Equipment[];
  workOrders: WorkOrder[];
  kpis: KPISnapshot[];
}) {
  const [expandedPred, setExpandedPred] = useState<string | null>(null);
  const predictions = generatePredictions(equipment);
  const anomalies = generateAnomalies(kpis);
  const optimizations = generateOptimizations();

  const totalSavings = optimizations.reduce((sum, o) => sum + o.savings_estimate, 0);

  return (
    <div className="space-y-4">
      {/* AI Header */}
      <div className="rounded-xl border border-[#8B5CF6]/20 bg-gradient-to-r from-[#8B5CF6]/5 to-[#0EA5E9]/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20">
            <Cpu size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">GRIXI AI — Análisis Predictivo</h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              Powered by Gemini · {predictions.length} predicciones · {anomalies.length} anomalías detectadas
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-[#8B5CF6]/10 px-2.5 py-0.5 text-[9px] font-bold text-[#8B5CF6]">
            <Zap size={10} />
            Actualizado hace 5 min
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Predictive Failures */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <Activity size={12} />
            Predicción de Fallas
          </h3>
          <div className="space-y-1.5">
            {predictions.map((pred, i) => (
              <motion.div
                key={pred.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedPred(expandedPred === pred.id ? null : pred.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: RISK_COLORS[pred.risk_level] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{pred.equipment_name}</p>
                    <p className="text-[9px] text-[#0EA5E9] font-mono">{pred.equipment_code}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold" style={{ color: RISK_COLORS[pred.risk_level] }}>
                      {pred.predicted_failure_days}d
                    </p>
                    <p className="text-[8px] text-[var(--text-muted)]">{(pred.confidence * 100).toFixed(0)}% conf.</p>
                  </div>
                  <ChevronRight size={12} className={`text-[var(--text-muted)] transition-transform ${expandedPred === pred.id ? "rotate-90" : ""}`} />
                </button>
                {expandedPred === pred.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="border-t border-[var(--border)] px-3 py-2.5 bg-[var(--bg-muted)]/30"
                  >
                    <p className="text-[10px] text-[var(--text-secondary)] mb-1.5">{pred.reasoning}</p>
                    <div className="flex items-start gap-1.5 rounded-md bg-[#0EA5E9]/5 px-2 py-1.5">
                      <CheckCircle2 size={10} className="text-[#0EA5E9] mt-0.5 shrink-0" />
                      <p className="text-[10px] text-[#0EA5E9] font-medium">{pred.recommendation}</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Trend Anomalies */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <TrendingUp size={12} />
              Anomalías en Tendencias
            </h3>
            <div className="space-y-1.5">
              {anomalies.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2 rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2"
                >
                  {a.severity === "warning" ? (
                    <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <TrendingUp size={12} className="text-green-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">{a.kpi}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{a.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Optimization Suggestions */}
          <div className="rounded-xl border border-[#10B981]/20 bg-[#10B981]/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#10B981]">
                <Zap size={12} />
                Optimizaciones Sugeridas
              </h3>
              <span className="text-xs font-bold text-[#10B981]">
                Ahorro est. ${totalSavings.toLocaleString()}
              </span>
            </div>
            <div className="space-y-1.5">
              {optimizations.map((opt, i) => (
                <motion.div
                  key={opt.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-lg bg-[var(--bg-surface)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[11px] font-semibold text-[var(--text-primary)]">{opt.title}</p>
                    <span className="text-xs font-bold text-[#10B981]">+${opt.savings_estimate.toLocaleString()}</span>
                  </div>
                  <p className="text-[9px] text-[var(--text-muted)]">{opt.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
