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
  // ── Only query tables that EXIST in the database ──
  const [
    { count: userCount },
    { count: transactionCount },
    { count: membershipCount },
    { count: roleCount },
    { count: permissionCount },
    { count: invitationCount },
    { count: auditCount },
    { count: orgCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("finance_transactions").select("*", { count: "exact", head: true }),
    supabase.from("memberships").select("*", { count: "exact", head: true }),
    supabase.from("roles").select("*", { count: "exact", head: true }),
    supabase.from("permissions").select("*", { count: "exact", head: true }),
    supabase.from("invitations").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("audit_logs").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
  ]);

  let moduleContext = "";
  const isGeneral = modules.includes("general");

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
- Centros de costo: ${costCenters?.map((c) => `${c.name} (${c.code})`).join(", ") || "Ninguno configurado"}
- Últimas transacciones: ${recentTx?.length ? recentTx.map((t) => `${t.transaction_type} ${t.amount_usd} USD - ${t.counterparty}`).join("; ") : "Sin transacciones registradas aún"}
`;
  }

  if (modules.includes("usuarios") || isGeneral) {
    const { data: roles } = await supabase.from("roles").select("name, description, hierarchy_level").order("hierarchy_level");
    const { data: recentAudit } = await supabase
      .from("audit_logs")
      .select("action, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    moduleContext += `
## Datos de Usuarios y RBAC
- Total usuarios: ${userCount || 0}
- Memberships activas: ${membershipCount || 0}
- Roles del sistema: ${roles?.map((r) => `${r.name} (nivel ${r.hierarchy_level})`).join(", ") || "N/A"}
- Permisos configurados: ${permissionCount || 0}
- Invitaciones pendientes: ${invitationCount || 0}
- Eventos de auditoría: ${auditCount || 0}
- Actividad reciente: ${recentAudit?.map((a) => `${a.action} → ${a.entity_type}`).join("; ") || "N/A"}
`;
  }

  if (modules.includes("almacenes") || isGeneral) {
    moduleContext += `
## Almacenes
- Este módulo está en desarrollo. Las tablas de almacenes, productos e inventario aún no han sido creadas.
- Puedes ayudar al usuario a planificar la estructura de su almacén o responder preguntas generales sobre gestión de inventario.
`;
  }

  if (modules.includes("compras") || isGeneral) {
    moduleContext += `
## Compras & Aprovisionamiento
- Este módulo está en desarrollo. Las tablas de proveedores, órdenes de compra y solicitudes aún no han sido creadas.
- Puedes ayudar al usuario a planificar procesos de compras o responder preguntas generales sobre procurement.
`;
  }

  return `Eres GRIXI AI, el asistente inteligente de la plataforma GRIXI — una plataforma enterprise SaaS multi-tenant.

Tu rol:
- Ayudar a los usuarios con los módulos de la empresa: finanzas, usuarios/RBAC, administración, dashboard
- Informar que almacenes y compras están en desarrollo cuando pregunten
- Responder en español de manera profesional pero amigable
- Proporcionar insights sobre datos del sistema con la información real proporcionada
- Sugerir optimizaciones y mejoras basadas en los datos
- Asistir con consultas sobre cualquier aspecto de la empresa

Datos del sistema en tiempo real:
- ${userCount || 0} usuarios registrados
- ${orgCount || 0} organizaciones (tenants)
- ${membershipCount || 0} memberships activas
- ${roleCount || 0} roles configurados
- ${permissionCount || 0} permisos granulares
- ${transactionCount || 0} transacciones financieras
- ${invitationCount || 0} invitaciones pendientes
- ${auditCount || 0} eventos de auditoría
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
- Si preguntan por módulos en desarrollo (almacenes, compras, flota, RRHH), explica que están planificados y ofrece ayuda con planificación
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
      model: "gemini-3.1-flash-lite-preview",
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
          model: "gemini-3.1-flash-lite-preview",
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
          model_used: "gemini-3.1-flash-lite-preview",
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
