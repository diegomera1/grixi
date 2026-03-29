import { GoogleGenAI } from "@google/genai";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import type { Route } from "./+types/api.ai.chat";

/**
 * GRIXI AI Chat — Server-side resource route
 * Handles SSE streaming from Gemini, conversation history, and DB persistence.
 */

type HistoryMsg = { role: "user" | "assistant"; content: string };

/** Build system prompt with real data from the active module context */
async function buildSystemPrompt(
  supabase: ReturnType<typeof createSupabaseServerClient>["supabase"],
  modules: string[]
): Promise<string> {
  const [
    { count: userCount },
    { count: warehouseCount },
    { count: productCount },
    { data: warehouses },
    { count: transactionCount },
    { count: vendorCount },
    { count: poCount },
    { count: prCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("name, type, location"),
    supabase.from("finance_transactions").select("*", { count: "exact", head: true }),
    supabase.from("vendors").select("*", { count: "exact", head: true }),
    supabase.from("purchase_orders").select("*", { count: "exact", head: true }),
    supabase.from("purchase_requisitions").select("*", { count: "exact", head: true }),
  ]);

  let moduleContext = "";
  const isGeneral = modules.includes("general");

  if (modules.includes("almacenes") || isGeneral) {
    const { data: products } = await supabase.from("products").select("name, category, sku, min_stock").limit(10);
    const { data: lowStock } = await supabase.from("products").select("name, min_stock").gt("min_stock", 0).limit(5);
    moduleContext += `
## Datos de Almacenes
- Almacenes: ${warehouses?.map((w) => `${w.name} (${w.type}, ${w.location})`).join(", ") || "N/A"}
- Productos catalogados: ${productCount || 0}
- Productos ejemplo: ${products?.map((p) => `${p.name} [${p.sku}]`).join(", ") || "N/A"}
- Productos con stock mínimo configurado: ${lowStock?.length || 0}
`;
  }

  if (modules.includes("finanzas") || isGeneral) {
    const { data: recentTx } = await supabase
      .from("finance_transactions")
      .select("transaction_type, category, amount_usd, currency, counterparty")
      .order("created_at", { ascending: false })
      .limit(5);
    const { data: costCenters } = await supabase.from("finance_cost_centers").select("name, code, department, budget_annual");
    moduleContext += `
## Datos de Finanzas
- Total transacciones: ${transactionCount || 0}
- Centros de costo: ${costCenters?.map((c) => `${c.name} (${c.code})`).join(", ") || "N/A"}
- Últimas transacciones: ${recentTx?.map((t) => `${t.transaction_type} ${t.amount_usd} USD - ${t.counterparty}`).join("; ") || "N/A"}
`;
  }

  if (modules.includes("usuarios") || isGeneral) {
    const { data: roles } = await supabase.from("roles").select("name, description");
    moduleContext += `
## Datos de Usuarios
- Total usuarios: ${userCount || 0}
- Roles del sistema: ${roles?.map((r) => r.name).join(", ") || "N/A"}
`;
  }

  if (modules.includes("compras") || isGeneral) {
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

  return `Eres GRIXI AI, el asistente inteligente de la plataforma GRIXI — una plataforma enterprise SaaS multi-tenant.

Tu rol:
- Ayudar a los usuarios con TODOS los modulos de la empresa: almacenes, finanzas, compras, usuarios, administracion, dashboard
- Responder en español de manera profesional pero amigable
- Proporcionar insights sobre datos del sistema con la información real proporcionada
- Sugerir optimizaciones y mejoras basadas en los datos
- Asistir con consultas sobre cualquier aspecto de la empresa

Datos del sistema en tiempo real:
- ${userCount || 0} usuarios en el sistema
- ${warehouseCount || 0} almacenes activos
- ${productCount || 0} productos catalogados
- ${transactionCount || 0} transacciones financieras registradas
- ${vendorCount || 0} proveedores
- ${poCount || 0} órdenes de compra
${moduleContext}

Módulo(s) activo(s): ${isGeneral ? "Vista general (todos los módulos)" : modules.join(", ")}

## Capacidades Especiales de Visualización

### Gráficos Interactivos
Cuando el usuario pida gráficos, dashboards, o visualizaciones de datos, genera un bloque especial con este formato EXACTO:
<!--CHART:{"type":"bar","title":"Título","description":"Descripción","data":[{"name":"Ene","valor":100}],"xKey":"name","yKeys":[{"key":"valor","label":"Valor","color":"#7C3AED"}]}-->

Tipos disponibles: "bar", "line", "area", "pie"
- Para "pie": usa un solo yKey y el xKey para las etiquetas
- Siempre usa data real del sistema cuando esté disponible
- Si no tienes datos exactos, genera datos de ejemplo realistas basados en el contexto
- Puedes generar MÚLTIPLES gráficos en una misma respuesta
- Los colores disponibles: #7C3AED (morado), #06B6D4 (cyan), #10B981 (verde), #F59E0B (ámbar), #F43F5E (rosa), #8B5CF6 (violeta), #F97316 (naranja)

### Tablas
Usa tablas markdown estándar cuando necesites mostrar datos tabulares.

Reglas:
- Siempre responde en español
- Sé conciso pero informativo
- Usa formato Markdown cuando sea apropiado (listas, negritas, tablas, headers)
- Si el usuario pregunta sobre datos específicos que tienes, responde con precisión
- Si no tienes información suficiente, sugiere dónde encontrarla en la plataforma
- No inventes datos que no se te hayan proporcionado (excepto para gráficos de ejemplo)
- Al final de cada respuesta, genera EXACTAMENTE 3 sugerencias de seguimiento relevantes en un bloque JSON especial con este formato:
<!--SUGGESTIONS-->
["sugerencia 1", "sugerencia 2", "sugerencia 3"]
<!--/SUGGESTIONS-->`;
}

/** Generate a short title for a conversation based on the first message */
async function generateTitle(apiKey: string, firstMessage: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: `Generate a very short title (4-6 words max) in Spanish for a conversation that starts with this message. Return ONLY the title text, nothing else:\n\n"${firstMessage}"`,
    });
    return response.text?.trim().replace(/^["']|["']$/g, "") || "Nueva conversación";
  } catch {
    return "Nueva conversación";
  }
}

export async function action({ request, context }: Route.ActionArgs) {
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

  const body = await request.json();
  const {
    conversationId,
    message,
    module,
    modules: modulesRaw,
    attachments = [],
  } = body as {
    conversationId: string;
    message: string;
    module?: string;
    modules?: string[];
    attachments: { id: string; name: string; url: string; type: string; size: number }[];
  };

  const modules: string[] = modulesRaw || (module ? [module] : ["general"]);

  if (!conversationId || !message) {
    return Response.json({ error: "Missing conversationId or message" }, { status: 400 });
  }

  // 1. Save user message
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
    attachments: JSON.stringify(attachments),
    model_used: "user",
    tokens_used: 0,
  });

  // 2. Get conversation history (last 10 messages)
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

  // 3. Build system prompt
  const systemPrompt = await buildSystemPrompt(supabase, modules);

  // 4. Build full prompt
  const contextParts = history
    .slice(0, -1)
    .map((msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`)
    .join("\n\n");

  let attachmentContext = "";
  if (attachments.length > 0) {
    attachmentContext = `\n\n[El usuario adjuntó ${attachments.length} archivo(s): ${attachments.map((a: { name: string; type: string }) => `${a.name} (${a.type})`).join(", ")}]`;
  }

  const fullPrompt = contextParts
    ? `${systemPrompt}\n\nHistorial de conversación reciente:\n${contextParts}\n\nUsuario: ${message}${attachmentContext}\n\nAsistente:`
    : `${systemPrompt}\n\nUsuario: ${message}${attachmentContext}\n\nAsistente:`;

  // 5. Stream from Gemini
  const ai = new GoogleGenAI({ apiKey });
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await ai.models.generateContentStream({
          model: "gemini-2.0-flash-lite",
          contents: fullPrompt,
        });

        for await (const chunk of result) {
          const text = chunk.text || "";
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();

        // 6. Save complete assistant response
        await supabase.from("ai_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullResponse,
          attachments: "[]",
          model_used: "gemini-2.0-flash-lite",
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
          message_count: (convData?.message_count || 0) + 2,
        };

        if (!convData?.title) {
          updatePayload.title = await generateTitle(apiKey, message);
        }

        await supabase.from("ai_conversations").update(updatePayload).eq("id", conversationId);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
