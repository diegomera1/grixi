"use server";

import { GoogleGenAI } from "@google/genai";
import type { Equipment, WorkOrder, KPISnapshot } from "../types";

// ── Response Types ──────────────────────────────

export type PredictiveInsight = {
  equipment_code: string;
  equipment_name: string;
  risk_level: "critical" | "high" | "medium" | "low";
  predicted_failure_days: number;
  confidence: number;
  recommendation: string;
  reasoning: string;
};

export type TrendAnomaly = {
  kpi: string;
  direction: "deteriorating" | "improving";
  detail: string;
  severity: "warning" | "info";
};

export type MaintenanceOptimization = {
  title: string;
  savings_estimate: number;
  detail: string;
  type: "schedule" | "inventory" | "crew";
};

export type AIAnalysisResult = {
  predictions: PredictiveInsight[];
  anomalies: TrendAnomaly[];
  optimizations: MaintenanceOptimization[];
  summary: string;
  generated_at: string;
};

// ── Prepare context for Gemini ──────────────────

function buildEquipmentContext(equipment: Equipment[]): string {
  return equipment
    .filter((e) => e.criticality === "critical" || e.criticality === "high")
    .map((e) => ({
      code: e.code,
      name: e.name,
      type: e.equipment_type,
      manufacturer: e.manufacturer,
      model: e.model,
      criticality: e.criticality,
      status: e.status,
      install_date: e.install_date,
      measurement_points: (e.measurement_points || []).map((mp) => ({
        name: mp.name,
        unit: mp.unit,
        type: mp.measurement_type,
        min: mp.min_value,
        max: mp.max_value,
        alert_threshold: mp.alert_threshold,
      })),
      bom_items_count: (e.bom_items || []).length,
      critical_bom_low: (e.bom_items || []).filter((b) => b.critical && b.quantity_onboard < b.quantity_required).length,
      maintenance_plans: (e.maintenance_plans || []).map((mp) => ({
        name: mp.name,
        strategy: mp.strategy_type,
        interval_hours: mp.interval_hours,
        last_executed: mp.last_executed,
        next_due: mp.next_due,
      })),
    }))
    .map((e) => JSON.stringify(e))
    .join("\n");
}

function buildWOContext(workOrders: WorkOrder[]): string {
  return workOrders.slice(0, 15).map((wo) => ({
    wo_number: wo.wo_number,
    title: wo.title,
    priority: wo.priority,
    status: wo.status,
    equipment_id: wo.equipment_id,
    hours_estimated: wo.hours_estimated,
    hours_actual: wo.hours_actual,
    cost_estimated: wo.cost_estimated,
    cost_actual: wo.cost_actual,
    planned_start: wo.planned_start,
    planned_end: wo.planned_end,
    actual_start: wo.actual_start,
    actual_end: wo.actual_end,
  })).map((w) => JSON.stringify(w)).join("\n");
}

function buildKPIContext(kpis: KPISnapshot[]): string {
  return kpis.map((k) => ({
    date: k.snapshot_date,
    mtbf: k.mtbf_hours,
    mttr: k.mttr_hours,
    availability: k.availability_pct,
    reliability: k.reliability_pct,
    maintenance_cost: k.maintenance_cost,
    fuel_consumption: k.fuel_consumption,
  })).map((k) => JSON.stringify(k)).join("\n");
}

// ── Main Server Action ──────────────────────────

export async function analyzeFleetPredictive(
  equipment: Equipment[],
  workOrders: WorkOrder[],
  kpis: KPISnapshot[]
): Promise<AIAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      predictions: [],
      anomalies: [],
      optimizations: [],
      summary: "GEMINI_API_KEY no configurada. Configura la API key en .env.local.",
      generated_at: new Date().toISOString(),
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const equipmentContext = buildEquipmentContext(equipment);
  const woContext = buildWOContext(workOrders);
  const kpiContext = buildKPIContext(kpis);

  const prompt = `Eres un ingeniero jefe de mantenimiento naval con 20 años de experiencia en buques tanqueros. 
Analiza los datos de mantenimiento del buque y genera un análisis predictivo completo.

EQUIPOS CRÍTICOS Y DE ALTA CRITICIDAD:
${equipmentContext}

ÓRDENES DE TRABAJO RECIENTES:
${woContext}

KPIs HISTÓRICOS (últimos meses):
${kpiContext}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "summary": "Resumen ejecutivo de 2-3 líneas del estado general de mantenimiento del buque, con indicadores clave",
  "predictions": [
    {
      "equipment_code": "Código del equipo (exacto de los datos)",
      "equipment_name": "Nombre del equipo (exacto de los datos)",
      "risk_level": "critical | high | medium | low",
      "predicted_failure_days": número de días estimados antes de falla potencial,
      "confidence": número entre 0.5 y 0.99 de confianza del modelo,
      "recommendation": "Acción concreta recomendada en español profesional marítimo",
      "reasoning": "Razonamiento técnico detallado del análisis predictivo en español"
    }
  ],
  "anomalies": [
    {
      "kpi": "Nombre del KPI afectado",
      "direction": "deteriorating | improving",
      "detail": "Descripción detallada de la tendencia detectada con datos específicos",
      "severity": "warning | info"
    }
  ],
  "optimizations": [
    {
      "title": "Título corto de la optimización",
      "savings_estimate": número estimado de ahorro en USD,
      "detail": "Descripción detallada de cómo implementar la optimización, mencionando WOs y equipos específicos",
      "type": "schedule | inventory | crew"
    }
  ]
}

REGLAS CRÍTICAS:
- Genera entre 4-8 predicciones de equipos basándote SOLO en los datos reales proporcionados
- Usa los códigos y nombres EXACTOS de los equipos de los datos
- Analiza las tendencias de los KPIs históricos para detectar anomalías reales
- Genera 3-5 anomalías basadas en los datos de KPI
- Genera 2-4 optimizaciones con ahorros estimados realistas para un buque tanquero
- Las predicciones deben basarse en: status del equipo, antigüedad, planes de mantenimiento vencidos, patrones de WOs
- Los días de falla deben ser realistas (7-180 días)
- La confianza debe reflejar la cantidad de datos disponibles
- Lenguaje técnico marítimo profesional en español
- Sé muy específico en las recomendaciones: menciona intervalos, puertos, procedimientos`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        predictions: [],
        anomalies: [],
        optimizations: [],
        summary: "No se pudo interpretar la respuesta del modelo de IA.",
        generated_at: new Date().toISOString(),
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    return {
      ...parsed,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Fleet AI] Analysis error:", error);
    return {
      predictions: [],
      anomalies: [],
      optimizations: [],
      summary: `Error al consultar Gemini: ${error instanceof Error ? error.message : "Error desconocido"}`,
      generated_at: new Date().toISOString(),
    };
  }
}
