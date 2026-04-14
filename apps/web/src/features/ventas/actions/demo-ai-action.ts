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

// ── Step-specific prompt builders ─────────────────

const STEP_PROMPTS: Record<DemoStepId, (data: Record<string, unknown>) => string> = {
  dashboard: (data) => {
    const kpis = data.kpis as VentasKPIs | undefined;
    if (!kpis) return "No hay datos de KPIs disponibles.";
    return `Estás viendo el Dashboard principal de Ventas de GRIXI. Datos visibles:
- Revenue total: $${(kpis.totalRevenue / 1000).toFixed(0)}K (cambio: ${kpis.totalRevenueChange > 0 ? "+" : ""}${kpis.totalRevenueChange.toFixed(1)}%)
- Clientes activos: ${kpis.activeCustomers} (cambio: ${kpis.activeCustomersChange > 0 ? "+" : ""}${kpis.activeCustomersChange.toFixed(1)}%)
- Deals en pipeline: ${kpis.openDeals}, valor: $${(kpis.pipelineValue / 1000).toFixed(0)}K
- Deals ganados: ${kpis.wonDeals} (cambio: ${kpis.wonDealsChange > 0 ? "+" : ""}${kpis.wonDealsChange.toFixed(1)}%)
- Ticket promedio: $${(kpis.avgDealSize / 1000).toFixed(1)}K
- Conversión: ${kpis.conversionRate.toFixed(1)}%
- Facturas vencidas: ${kpis.overdueInvoices} ($${(kpis.overdueAmount / 1000).toFixed(0)}K)
- Cotizaciones abiertas: ${kpis.quotesOpen}, convertidas: ${kpis.quotesConverted}
Top productos: ${(data.topProducts as TopProduct[] || []).slice(0, 3).map(p => `${p.name} ($${(p.revenue / 1000).toFixed(0)}K)`).join(", ")}`;
  },

  clientes: (data) => {
    const customers = (data.customers as SalesCustomer[] || []);
    const topClients = customers
      .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
      .slice(0, 8);
    const segments = customers.reduce((acc, c) => {
      acc[c.segment] = (acc[c.segment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const avgHealth = customers.length > 0
      ? Math.round(customers.reduce((s, c) => s + c.health_score, 0) / customers.length)
      : 0;

    return `Estás viendo la lista de Clientes del CRM de GRIXI. Datos visibles:
- Total clientes: ${customers.length}
- Health score promedio: ${avgHealth}/100
- Segmentación: ${Object.entries(segments).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Top clientes por revenue:
${topClients.map((c, i) => `  ${i + 1}. ${c.trade_name || c.business_name} (${c.country}) — $${(Number(c.total_revenue) / 1000).toFixed(0)}K — Health: ${c.health_score} — Segment: ${c.segment}`).join("\n")}
- Clientes at_risk: ${customers.filter(c => c.segment === "at_risk").length}
- Clientes dormidos: ${customers.filter(c => c.segment === "dormant").length}`;
  },

  ventas: (data) => {
    const invoices = (data.invoices as SalesInvoice[] || []);
    const total = invoices.reduce((s, i) => s + Number(i.total_usd), 0);
    const statusDist = invoices.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const recent = invoices
      .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())
      .slice(0, 5);

    return `Estás viendo las Facturas de Venta de GRIXI. Datos visibles:
- Total facturas: ${invoices.length}
- Revenue total: $${(total / 1000).toFixed(0)}K
- Ticket promedio: $${invoices.length > 0 ? (total / invoices.length / 1000).toFixed(1) : 0}K
- Distribución por status: ${Object.entries(statusDist).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Últimas 5 facturas:
${recent.map(i => `  ${i.invoice_number} — ${i.customer?.trade_name || i.customer?.business_name || "?"} — $${Number(i.total_usd).toLocaleString("en")} — ${i.status}`).join("\n")}`;
  },

  pipeline: (data) => {
    const stages = (data.stages as SalesPipelineStage[] || []);
    const opps = (data.opportunities as SalesOpportunity[] || []);
    const stageMetrics = stages
      .filter(s => s.is_active)
      .sort((a, b) => a.position - b.position)
      .map(s => {
        const stgOpps = opps.filter(o => o.stage_id === s.id);
        return {
          name: s.name,
          count: stgOpps.length,
          amount: stgOpps.reduce((sum, o) => sum + Number(o.amount), 0),
        };
      });

    return `Estás viendo el Pipeline de Ventas (funnel) de GRIXI. Datos visibles:
- Total deals activos: ${opps.length}
- Valor pipeline total: $${(opps.reduce((s, o) => s + Number(o.amount), 0) / 1000).toFixed(0)}K
- Etapas del funnel:
${stageMetrics.map(s => `  ${s.name}: ${s.count} deals — $${(s.amount / 1000).toFixed(0)}K`).join("\n")}
- Deal más grande: ${opps.length > 0 ? `${opps.sort((a, b) => Number(b.amount) - Number(a.amount))[0].name} ($${(Number(opps[0]?.amount || 0) / 1000).toFixed(0)}K)` : "N/A"}`;
  },

  cotizaciones: (data) => {
    const quotes = (data.quotes as SalesQuote[] || []);
    const statusDist = quotes.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const totalValue = quotes.reduce((s, q) => s + Number(q.total), 0);

    return `Estás viendo las Cotizaciones del CRM de GRIXI. Datos visibles:
- Total cotizaciones: ${quotes.length}
- Valor total: $${(totalValue / 1000).toFixed(0)}K
- Distribución por status: ${Object.entries(statusDist).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Tasa de conversión: ${quotes.length > 0 ? ((statusDist["converted"] || 0) / quotes.length * 100).toFixed(0) : 0}%`;
  },

  reportes: (data) => {
    const invoices = (data.invoices as SalesInvoice[] || []);
    const customers = (data.customers as SalesCustomer[] || []);
    const countries = new Map<string, { revenue: number; clients: number; invoices: number }>();
    for (const inv of invoices) {
      const country = inv.customer?.country || "Desconocido";
      const prev = countries.get(country) || { revenue: 0, clients: 0, invoices: 0 };
      prev.revenue += Number(inv.total_usd);
      prev.invoices += 1;
      countries.set(country, prev);
    }
    for (const c of customers) {
      const prev = countries.get(c.country) || { revenue: 0, clients: 0, invoices: 0 };
      prev.clients += 1;
      countries.set(c.country, prev);
    }
    const sortedCountries = [...countries.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

    return `Estás viendo los Reportes Geográficos de GRIXI con el mapa mundial interactivo. Datos visibles:
- Países con actividad: ${countries.size}
- Revenue global: $${(invoices.reduce((s, i) => s + Number(i.total_usd), 0) / 1000).toFixed(0)}K
- Top países por revenue:
${sortedCountries.slice(0, 6).map(([name, d]) => `  ${name}: $${(d.revenue / 1000).toFixed(0)}K — ${d.clients} clientes — ${d.invoices} facturas`).join("\n")}`;
  },
};

// ── System prompt ─────────────────────────────────

const SYSTEM_PROMPT = `Eres GRIXI AI, el asistente inteligente de la plataforma empresarial GRIXI. 
Estás narrando una demo interactiva del módulo de Ventas & CRM.

Tu rol:
- Analizar la data visible en cada pantalla y dar un insight ejecutivo breve
- Identificar patrones, riesgos, oportunidades con datos específicos
- Hablar en español profesional pero cercano
- Ser conciso: máximo 3-4 oraciones
- Usar cifras específicas de la data, no generalidades
- Terminar con una acción recomendada o insight clave
- NO usar markdown, emojis excesivos, ni listas largas
- Hablar como un analista de negocio senior que presenta hallazgos`;

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
      model: "gemini-2.0-flash-lite",
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\n--- DATA DEL TAB ACTUAL ---\n${dataDescription}\n\n--- INSTRUCCIÓN ---\nDa tu análisis ejecutivo de lo que ves en esta pantalla.` }],
        },
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 300,
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
