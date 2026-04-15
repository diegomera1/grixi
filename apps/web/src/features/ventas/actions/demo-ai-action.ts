"use server";

import { GoogleGenAI } from "@google/genai";
import type {
  VentasKPIs,
  SalesCustomer,
  SalesOpportunity,
  SalesInvoice,
  SalesQuote,
  SalesPipelineStage,
  TopProduct,
} from "../types";

// ── Types ─────────────────────────────────────────

export type DemoStepId =
  | "dashboard"
  | "clientes"
  | "ventas"
  | "pipeline"
  | "cotizaciones"
  | "reportes";

type DemoStepContext = {
  stepId: DemoStepId;
  data: Record<string, unknown>;
};

type DemoAIResponse = {
  insight: string;
  error?: string;
};

// ── Currency formatter ────────────────────────────

function fmtUSD(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// ── Step-specific prompt builders ─────────────────

const STEP_PROMPTS: Record<DemoStepId, (data: Record<string, unknown>) => string> = {
  dashboard: (data) => {
    const kpis = data.kpis as VentasKPIs | undefined;
    if (!kpis) return "No hay datos de KPIs disponibles.";
    const topProds = (data.topProducts as TopProduct[] || []).slice(0, 3);
    return `SECCIÓN: Dashboard de Ventas — centro de control con KPIs en tiempo real.
FUNCIONALIDADES: Muestra revenue total, clientes activos, deals en pipeline, tasa de conversión, facturas vencidas, cotizaciones abiertas, top productos y tendencia de ventas con gráficos interactivos.
DATOS CLAVE:
• Revenue: ${fmtUSD(kpis.totalRevenue)} (${kpis.totalRevenueChange > 0 ? "+" : ""}${kpis.totalRevenueChange.toFixed(1)}%)
• ${kpis.activeCustomers} clientes activos, ${kpis.openDeals} deals abiertos por ${fmtUSD(kpis.pipelineValue)}
• Conversión: ${kpis.conversionRate.toFixed(1)}%, ticket promedio: ${fmtUSD(kpis.avgDealSize)}
• ${kpis.overdueInvoices} facturas vencidas por ${fmtUSD(kpis.overdueAmount)}
• Top productos: ${topProds.map(p => `${p.name} (${fmtUSD(p.revenue)})`).join(", ")}`;
  },

  clientes: (data) => {
    const customers = (data.customers as SalesCustomer[] || []);
    const segments = customers.reduce((acc, c) => {
      acc[c.segment] = (acc[c.segment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const avgHealth = customers.length > 0
      ? Math.round(customers.reduce((s, c) => s + c.health_score, 0) / customers.length)
      : 0;
    const topClient = customers.sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))[0];

    return `SECCIÓN: CRM de Clientes — gestión de cartera con segmentación inteligente y health score.
FUNCIONALIDADES: Permite buscar, filtrar por segmento (Champion, Loyal, New, At Risk, Dormant, Prospect), ver el health score de cada cliente, su revenue acumulado, contactos, y al hacer clic en un cliente se despliega su perfil completo con historial de compras.
DATOS CLAVE:
• ${customers.length} clientes, health score promedio: ${avgHealth}/100
• Segmentos: ${Object.entries(segments).map(([k, v]) => `${k}: ${v}`).join(", ")}
• Cliente principal: ${topClient?.trade_name || topClient?.business_name || "N/A"} con ${fmtUSD(Number(topClient?.total_revenue || 0))}
• ${segments["at_risk"] || 0} clientes en riesgo, ${segments["dormant"] || 0} dormidos`;
  },

  ventas: (data) => {
    const invoices = (data.invoices as SalesInvoice[] || []);
    const total = invoices.reduce((s, i) => s + Number(i.total_usd), 0);
    const statusDist = invoices.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `SECCIÓN: Facturación — registro y seguimiento de todas las ventas.
FUNCIONALIDADES: Crear nuevas ventas con productos del catálogo, gestionar estados (pagada, pendiente, vencida, cancelada), buscar facturas, filtrar por estado, exportar datos a CSV. Al hacer clic en una factura se abre su detalle con todos los productos y montos.
DATOS CLAVE:
• ${invoices.length} facturas, revenue total: ${fmtUSD(total)}
• Ticket promedio: ${invoices.length > 0 ? fmtUSD(total / invoices.length) : "$0"}
• Estados: ${Object.entries(statusDist).map(([k, v]) => `${k}: ${v}`).join(", ")}`;
  },

  pipeline: (data) => {
    const stages = (data.stages as SalesPipelineStage[] || []);
    const opps = (data.opportunities as SalesOpportunity[] || []);
    const totalValue = opps.reduce((s, o) => s + Number(o.amount), 0);
    const stageMetrics = stages
      .filter(s => s.is_active)
      .sort((a, b) => a.position - b.position)
      .map(s => {
        const stgOpps = opps.filter(o => o.stage_id === s.id);
        const amt = stgOpps.reduce((sum, o) => sum + Number(o.amount), 0);
        return `${s.name}: ${stgOpps.length} deals (${fmtUSD(amt)})`;
      });

    return `SECCIÓN: Pipeline de Ventas — embudo comercial con drag & drop.
FUNCIONALIDADES: Visualiza las oportunidades organizadas por etapa del funnel. Se pueden arrastrar deals entre etapas, mover con menú rápido, filtrar por monto, y ver probabilidad de cierre. Incluye un gráfico de embudo interactivo en la parte superior.
DATOS CLAVE:
• ${opps.length} deals activos, valor total: ${fmtUSD(totalValue)}
• Etapas: ${stageMetrics.join(" → ")}`;
  },

  cotizaciones: (data) => {
    const quotes = (data.quotes as SalesQuote[] || []);
    const statusDist = quotes.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const totalValue = quotes.reduce((s, q) => s + Number(q.total), 0);
    const convRate = quotes.length > 0 ? ((statusDist["converted"] || 0) / quotes.length * 100).toFixed(0) : "0";

    return `SECCIÓN: Cotizaciones — propuestas comerciales con ciclo de vida completo.
FUNCIONALIDADES: Crear cotizaciones con productos del catálogo, gestionar estados (borrador, enviada, aprobada, rechazada, convertida), configurar vigencia, descuentos y términos. Las cotizaciones aprobadas se pueden convertir directamente en ventas.
DATOS CLAVE:
• ${quotes.length} cotizaciones, valor total: ${fmtUSD(totalValue)}
• Estados: ${Object.entries(statusDist).map(([k, v]) => `${k}: ${v}`).join(", ")}
• Tasa de conversión: ${convRate}%`;
  },

  reportes: (data) => {
    const invoices = (data.invoices as SalesInvoice[] || []);
    const customers = (data.customers as SalesCustomer[] || []);
    const countries = new Map<string, { revenue: number; clients: number }>();
    for (const inv of invoices) {
      const country = inv.customer?.country || "Desconocido";
      const prev = countries.get(country) || { revenue: 0, clients: 0 };
      prev.revenue += Number(inv.total_usd);
      countries.set(country, prev);
    }
    for (const c of customers) {
      const prev = countries.get(c.country) || { revenue: 0, clients: 0 };
      prev.clients += 1;
      countries.set(c.country, prev);
    }
    const sorted = [...countries.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
    const globalRev = invoices.reduce((s, i) => s + Number(i.total_usd), 0);

    return `SECCIÓN: Reportes Geográficos — mapa mundial interactivo con distribución de ventas por país.
FUNCIONALIDADES: Mapa de calor con revenue por país. Al hacer clic en un país se abre un drawer con detalle de clientes, facturas y estadísticas. Se pueden expandir los perfiles de clientes y facturas directamente desde el drawer.
DATOS CLAVE:
• ${countries.size} países, revenue global: ${fmtUSD(globalRev)}
• Top: ${sorted.slice(0, 3).map(([n, d]) => `${n} (${fmtUSD(d.revenue)}, ${d.clients} clientes)`).join(", ")}`;
  },
};

// ── System prompt ─────────────────────────────────

const SYSTEM_PROMPT = `Eres el narrador de una demo interactiva del módulo Ventas & CRM de GRIXI, una plataforma empresarial.

Reglas:
- Responde en exactamente 3 oraciones
- Primera oración: describe para qué sirve esta sección y qué problema resuelve
- Segunda oración: menciona 2-3 funcionalidades clave que el usuario puede realizar
- Tercera oración: destaca un dato o cifra relevante como ejemplo real
- Los valores en dólares SIEMPRE deben formatearse como $X.XK o $X.XM (nunca "mil dólares" ni valores crudos)
- Habla en español profesional y directo
- NO uses markdown, emojis, listas, bullets ni saltos de línea
- NO repitas las cifras tal cual están en los datos, redondéalas limpiamente`;

// ── Main Action ───────────────────────────────────

export async function analyzeDemoStep(context: DemoStepContext): Promise<DemoAIResponse> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { insight: "API key de Gemini no configurada. Verifica GEMINI_API_KEY en .env.local.", error: "missing_key" };
    }

    const promptBuilder = STEP_PROMPTS[context.stepId];
    if (!promptBuilder) {
      return { insight: "Paso de demo no reconocido.", error: "invalid_step" };
    }

    const dataDescription = promptBuilder(context.data);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\n--- SECCIÓN ACTUAL ---\n${dataDescription}\n\n--- INSTRUCCIÓN ---\nNarra esta sección de la demo en 3 oraciones: para qué sirve, qué se puede hacer, y un dato destacado.` }],
        },
      ],
      config: {
        temperature: 0.4,
        maxOutputTokens: 180,
      },
    });

    const text = response.text?.trim() || "No se pudo generar el análisis.";

    return { insight: text };
  } catch (err) {
    console.error("[Demo AI] Error:", err);
    return {
      insight: "Hubo un error al analizar esta vista. La demo continúa normalmente.",
      error: String(err),
    };
  }
}
