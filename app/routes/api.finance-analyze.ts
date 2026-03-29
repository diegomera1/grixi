import { GoogleGenAI } from "@google/genai";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

/**
 * GRIXI Finance AI Analysis — Resource route
 * POST: Analyze a financial transaction using Gemini
 */

const FINANCE_SYSTEM_PROMPT = `Eres GRIXI Finance AI, el asistente financiero inteligente de la plataforma GRIXI.

Tu rol:
- Analizar transacciones financieras y generar insights accionables
- Detectar riesgos, anomalías o oportunidades de optimización
- Responder siempre en español, de manera profesional y concisa
- Usar formato Markdown con negritas, listas y emojis relevantes
- Ser muy específico — no genérico

Reglas:
- Respuestas de máximo 200 palabras
- Empieza con un emoji que represente el tipo de análisis
- Si el monto es inusualmente alto o bajo, señálalo
- Si la fecha de vencimiento está cerca o pasada, alerta
- Si hay oportunidades de negociación de condiciones de pago, menciónalas
- Si el IVA parece incorrecto, notifícalo
- Compara con promedios del sector cuando sea relevante`;

interface TxPayload {
  transaction_type: string;
  category: string;
  department: string;
  amount: number;
  currency: string;
  counterparty: string;
  description: string;
  tax_rate: number;
  tax_amount: number;
  net_amount: number | null;
  payment_terms: string;
  due_date: string | null;
  status: string;
  cost_center_code: string | null;
  gl_account: string | null;
  sap_document_id: string;
  invoice_number: string | null;
  created_at: string;
  notes: string | null;
}

export async function action({ request, context }: { request: Request; context: { cloudflare: { env: Env } } }) {
  const env = context.cloudflare.env;
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { supabase } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tx = (await request.json()) as TxPayload;

  const prompt = `${FINANCE_SYSTEM_PROMPT}

Analiza esta transacción financiera:

**Tipo:** ${tx.transaction_type}
**Categoría:** ${tx.category}
**Departamento:** ${tx.department}
**Monto:** ${tx.currency} ${tx.amount?.toLocaleString("es") || "0"}
**Contraparte:** ${tx.counterparty}
**Descripción:** ${tx.description}
**IVA:** ${tx.tax_rate}% (${tx.currency} ${tx.tax_amount?.toLocaleString("es") || "0"})
**Monto Neto:** ${tx.currency} ${tx.net_amount?.toLocaleString("es") || "N/A"}
**Condición de Pago:** ${tx.payment_terms}
**Vencimiento:** ${tx.due_date || "No especificado"}
**Estado:** ${tx.status}
**Centro de Costo:** ${tx.cost_center_code || "N/A"}
**Cuenta Contable:** ${tx.gl_account || "N/A"}
**SAP Doc:** ${tx.sap_document_id}
**Factura:** ${tx.invoice_number || "N/A"}
**Fecha:** ${tx.created_at}
${tx.notes ? `**Notas existentes:** ${tx.notes}` : ""}

Genera un análisis breve con: 1) Resumen, 2) Riesgos potenciales, 3) Recomendaciones.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
    });

    return Response.json({ analysis: response.text || "" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Error de IA: ${msg}` }, { status: 500 });
  }
}
