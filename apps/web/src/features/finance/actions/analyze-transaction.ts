"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const FINANCE_SYSTEM_PROMPT = `Eres GRIXI Finance AI, el asistente financiero inteligente de la plataforma Grixi.

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

type TransactionData = {
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
  invoice_number: string | null;
  sap_document_id: string;
  created_at: string;
  notes: string | null;
};

export async function analyzeTransaction(
  tx: TransactionData
): Promise<{ analysis: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { analysis: "", error: "GEMINI_API_KEY no configurada." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `${FINANCE_SYSTEM_PROMPT}

Analiza esta transacción financiera:

**Tipo:** ${tx.transaction_type}
**Categoría:** ${tx.category}
**Departamento:** ${tx.department}
**Monto:** ${tx.currency} ${tx.amount.toLocaleString("es")}
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

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });

    return { analysis: response.text || "" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return { analysis: "", error: `Error de IA: ${msg}` };
  }
}

export async function updateTransactionNotes(
  transactionId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("finance_transactions")
    .update({ notes })
    .eq("id", transactionId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
