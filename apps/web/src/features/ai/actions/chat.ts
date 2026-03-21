"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import type { Attachment } from "../types";

type HistoryMsg = {
  role: "user" | "assistant";
  content: string;
};

/** Build the system prompt with real data from the current module context */
async function buildSystemPrompt(module: string): Promise<string> {
  const supabase = await createClient();

  // Fetch real-time system stats
  const [
    { count: userCount },
    { count: warehouseCount },
    { count: productCount },
    { data: warehouses },
    { count: transactionCount },
    { count: vendorCount },
    { count: poCount },
    { count: prCount },
    { count: fleetEquipmentCount },
    { count: fleetWOCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("name, type, location"),
    supabase.from("finance_transactions").select("*", { count: "exact", head: true }),
    supabase.from("vendors").select("*", { count: "exact", head: true }),
    supabase.from("purchase_orders").select("*", { count: "exact", head: true }),
    supabase.from("purchase_requisitions").select("*", { count: "exact", head: true }),
    supabase.from("fleet_equipment").select("*", { count: "exact", head: true }),
    supabase.from("fleet_work_orders").select("*", { count: "exact", head: true }),
  ]);

  // Module-specific data enrichment
  let moduleContext = "";

  if (module === "almacenes" || module === "general") {
    const { data: products } = await supabase
      .from("products")
      .select("name, category, sku, min_stock")
      .limit(10);

    const { data: lowStock } = await supabase
      .from("products")
      .select("name, min_stock")
      .gt("min_stock", 0)
      .limit(5);

    moduleContext += `
## Datos de Almacenes
- Almacenes: ${warehouses?.map((w) => `${w.name} (${w.type}, ${w.location})`).join(", ") || "N/A"}
- Productos catalogados: ${productCount || 0}
- Productos ejemplo: ${products?.map((p) => `${p.name} [${p.sku}]`).join(", ") || "N/A"}
- Productos con stock mínimo configurado: ${lowStock?.length || 0}
`;
  }

  if (module === "finanzas" || module === "general") {
    const { data: recentTx } = await supabase
      .from("finance_transactions")
      .select("transaction_type, category, amount_usd, currency, counterparty")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: costCenters } = await supabase
      .from("finance_cost_centers")
      .select("name, code, department, budget_annual");

    moduleContext += `
## Datos de Finanzas
- Total transacciones: ${transactionCount || 0}
- Centros de costo: ${costCenters?.map((c) => `${c.name} (${c.code})`).join(", ") || "N/A"}
- Últimas transacciones: ${recentTx?.map((t) => `${t.transaction_type} ${t.amount_usd} USD - ${t.counterparty}`).join("; ") || "N/A"}
`;
  }

  if (module === "compras" || module === "general") {
    const { data: topVendors } = await supabase
      .from("vendors")
      .select("name, code, category, compliance_score, quality_score")
      .eq("is_active", true)
      .order("compliance_score", { ascending: false })
      .limit(5);

    const { data: recentPOs } = await supabase
      .from("purchase_orders")
      .select("po_number, status, total")
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: openPOCount } = await supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "pending_approval", "approved", "sent"]);

    moduleContext += `
## Datos de Compras & Aprovisionamiento
- Total proveedores activos: ${vendorCount || 0}
- Total órdenes de compra: ${poCount || 0}
- OC abiertas: ${openPOCount || 0}
- Solicitudes de pedido: ${prCount || 0}
- Top proveedores: ${topVendors?.map((v) => `${v.name} (${v.category}, cumplimiento: ${v.compliance_score}%)`).join("; ") || "N/A"}
- Últimas OC: ${recentPOs?.map((p) => `${p.po_number} [${p.status}] $${p.total}`).join("; ") || "N/A"}
`;
  }

  if (module === "usuarios" || module === "general") {
    const { data: roles } = await supabase
      .from("roles")
      .select("name, description");

    moduleContext += `
## Datos de Usuarios
- Total usuarios: ${userCount || 0}
- Roles del sistema: ${roles?.map((r) => r.name).join(", ") || "N/A"}
`;
  }

  if (module === "flota" || module === "general") {
    const { data: vessels } = await supabase
      .from("fleet_vessels")
      .select("name, imo_number, vessel_type, status, flag")
      .limit(5);

    const { data: equipmentByStatus } = await supabase
      .from("fleet_equipment")
      .select("name, code, equipment_type, criticality, status")
      .order("criticality", { ascending: true })
      .limit(15);

    const criticalEquip = equipmentByStatus?.filter((e) => e.criticality === "critical" || e.criticality === "high") || [];

    const { data: recentWOs } = await supabase
      .from("fleet_work_orders")
      .select("wo_number, title, priority, status")
      .order("created_at", { ascending: false })
      .limit(8);

    const { count: openWOCount } = await supabase
      .from("fleet_work_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "on_hold"]);

    const { data: activeAlerts } = await supabase
      .from("fleet_alerts")
      .select("title, severity, alert_type, equipment_name")
      .is("resolved_at", null)
      .limit(10);

    const { data: recentFuel } = await supabase
      .from("fleet_fuel_logs")
      .select("log_date, fuel_type, consumption_rate_mt_day, rob_after")
      .order("log_date", { ascending: false })
      .limit(7);

    const { data: expiringCerts } = await supabase
      .from("fleet_certificates")
      .select("cert_type, status, expiry_date")
      .in("status", ["expiring_soon", "expired"])
      .limit(10);

    const { data: latestKPIs } = await supabase
      .from("fleet_kpi_snapshots")
      .select("snapshot_date, mtbf_hours, mttr_hours, availability_pct, maintenance_cost")
      .order("snapshot_date", { ascending: false })
      .limit(3);

    const { data: crewMembers } = await supabase
      .from("fleet_crew")
      .select("name, rank, department, status")
      .eq("status", "onboard");

    const fuelWithRate = recentFuel?.filter((f) => f.consumption_rate_mt_day) || [];
    const avgConsumption = fuelWithRate.length > 0
      ? fuelWithRate.reduce((sum, f) => sum + (f.consumption_rate_mt_day || 0), 0) / fuelWithRate.length
      : 0;

    moduleContext += `
## Datos de Flota & Mantenimiento Naval
- Buques: ${vessels?.map((v) => `${v.name} (IMO: ${v.imo_number}, ${v.vessel_type}, estado: ${v.status})`).join("; ") || "N/A"}
- Total equipos: ${fleetEquipmentCount || 0}
- Equipos criticos/altos: ${criticalEquip.map((e) => `${e.name} [${e.code}] (${e.criticality}, ${e.status})`).join("; ") || "N/A"}
- Total OT: ${fleetWOCount || 0}, abiertas: ${openWOCount || 0}
- OT recientes: ${recentWOs?.map((w) => `${w.wo_number} - ${w.title} [${w.priority}, ${w.status}]`).join("; ") || "N/A"}
- Alertas activas: ${activeAlerts?.length || 0} - ${activeAlerts?.map((a) => `${a.severity}: ${a.title}`).join("; ") || "Sin alertas"}
- Combustible: consumo promedio ${avgConsumption.toFixed(1)} MT/dia, ROB: ${recentFuel?.[0]?.rob_after?.toFixed(1) || "N/A"} MT
- Certificados por vencer: ${expiringCerts?.map((c) => `${c.cert_type} [${c.status}] vence ${c.expiry_date}`).join("; ") || "Todos vigentes"}
- Tripulacion a bordo: ${crewMembers?.length || 0} - ${crewMembers?.map((c) => `${c.name} (${c.rank})`).join("; ") || "N/A"}
- KPIs: ${latestKPIs?.map((k) => `${k.snapshot_date}: Disp.${k.availability_pct}%, MTBF ${k.mtbf_hours}h, MTTR ${k.mttr_hours}h`).join("; ") || "N/A"}
`;
  }

  return `Eres GRIXI AI, el asistente inteligente de la plataforma GRIXI — una plataforma enterprise SaaS multi-tenant.

Tu rol:
- Ayudar a los usuarios con TODOS los modulos de la empresa: almacenes, compras, finanzas, flota (mantenimiento naval), usuarios, administracion, dashboard
- Responder en espanol de manera profesional pero amigable
- Proporcionar insights sobre datos del sistema con la informacion real proporcionada
- Sugerir optimizaciones y mejoras basadas en los datos
- Asistir con consultas sobre cualquier aspecto de la empresa
- Cuando el modulo activo es Flota, usar terminologia maritima profesional

Datos del sistema en tiempo real:
- ${userCount || 0} usuarios en el sistema
- ${warehouseCount || 0} almacenes activos
- ${productCount || 0} productos catalogados
- ${transactionCount || 0} transacciones financieras
- ${vendorCount || 0} proveedores
- ${poCount || 0} ordenes de compra
- ${fleetEquipmentCount || 0} equipos de flota
- ${fleetWOCount || 0} OT de flota
${moduleContext}

Modulo activo actual: ${module === "general" ? "Vista general (todos los modulos)" : module}

Reglas:
- Siempre responde en espanol
- Se conciso pero informativo
- Usa formato Markdown cuando sea apropiado (listas, negritas, tablas, headers)
- Si el usuario pregunta sobre datos especificos que tienes, responde con precision
- Si no tienes informacion suficiente, sugiere donde encontrarla en la plataforma
- No inventes datos que no se te hayan proporcionado
- Puedes analizar imagenes y archivos adjuntos si el usuario los envia`;
}

/** Generate a short title for a conversation based on the first message */
async function generateTitle(firstMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Nueva conversación";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Generate a very short title (4-6 words max) in Spanish for a conversation that starts with this message. Return ONLY the title text, nothing else:\n\n"${firstMessage}"`,
    });
    return response.text?.trim().replace(/^["']|["']$/g, "") || "Nueva conversación";
  } catch {
    return "Nueva conversación";
  }
}

/** Send a chat message to AI and persist both user + assistant messages */
export async function sendChatMessage(
  conversationId: string,
  userMessage: string,
  module: string = "general",
  attachments: Attachment[] = []
): Promise<{ response: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { response: "", error: "La API key de IA no está configurada." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: "", error: "No autenticado" };

  try {
    // 1. Save user message to DB
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
      attachments: JSON.stringify(attachments),
      model_used: "user",
      tokens_used: 0,
    });

    // 2. Get conversation history from DB (last 10 messages)
    const { data: historyData } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const history: HistoryMsg[] = (historyData || []).reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 3. Build system prompt with real data
    const systemPrompt = await buildSystemPrompt(module);

    // 4. Build full prompt with history context
    const contextParts = history
      .slice(0, -1) // exclude current message (already included)
      .map(
        (msg) =>
          `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
      )
      .join("\n\n");

    // Include attachment descriptions in the prompt
    let attachmentContext = "";
    if (attachments.length > 0) {
      attachmentContext = `\n\n[El usuario adjuntó ${attachments.length} archivo(s): ${attachments.map((a) => `${a.name} (${a.type})`).join(", ")}]`;
    }

    const fullPrompt = contextParts
      ? `${systemPrompt}\n\nHistorial de conversación reciente:\n${contextParts}\n\nUsuario: ${userMessage}${attachmentContext}\n\nAsistente:`
      : `${systemPrompt}\n\nUsuario: ${userMessage}${attachmentContext}\n\nAsistente:`;

    // 5. Call AI
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: fullPrompt,
    });

    const text = response.text || "";

    // 6. Save assistant response to DB
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: text,
      attachments: "[]",
      model_used: "default",
      tokens_used: 0,
    });

    // 7. Update conversation metadata
    const { data: convData } = await supabase
      .from("ai_conversations")
      .select("title, message_count")
      .eq("id", conversationId)
      .single();

    const updatePayload: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      message_count: (convData?.message_count || 0) + 2, // user + assistant
    };

    // Auto-generate title on first message
    if (!convData?.title) {
      updatePayload.title = await generateTitle(userMessage);
    }

    await supabase
      .from("ai_conversations")
      .update(updatePayload)
      .eq("id", conversationId);

    return { response: text };
  } catch (error: unknown) {
    console.error("AI service error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return {
      response: "",
      error: `Error al comunicarse con el servicio de IA: ${errorMessage}`,
    };
  }
}
