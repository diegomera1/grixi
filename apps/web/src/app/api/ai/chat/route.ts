import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type HistoryMsg = {
  role: "user" | "assistant";
  content: string;
};

/** Build the system prompt with real data from the current module context */
async function buildSystemPrompt(modules: string[]): Promise<string> {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: warehouseCount },
    { count: productCount },
    { data: warehouses },
    { count: transactionCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("name, type, location"),
    supabase
      .from("finance_transactions")
      .select("*", { count: "exact", head: true }),
  ]);

  let moduleContext = "";

  const isGeneral = modules.includes("general");

  if (modules.includes("almacenes") || isGeneral) {
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

  if (modules.includes("finanzas") || isGeneral) {
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

  if (modules.includes("usuarios") || isGeneral) {
    const { data: roles } = await supabase
      .from("roles")
      .select("name, description");

    moduleContext += `
## Datos de Usuarios
- Total usuarios: ${userCount || 0}
- Roles del sistema: ${roles?.map((r) => r.name).join(", ") || "N/A"}
`;
  }

  return `Eres GRIXI AI, el asistente inteligente de la plataforma GRIXI — una plataforma enterprise SaaS multi-tenant.

Tu rol:
- Ayudar a los usuarios con TODOS los módulos de la empresa: almacenes, finanzas, compras, usuarios, administración, dashboard
- Responder en español de manera profesional pero amigable
- Proporcionar insights sobre datos del sistema con la información real proporcionada
- Sugerir optimizaciones y mejoras basadas en los datos
- Asistir con consultas sobre cualquier aspecto de la empresa

Datos del sistema en tiempo real:
- ${userCount || 0} usuarios en el sistema
- ${warehouseCount || 0} almacenes activos
- ${productCount || 0} productos catalogados
- ${transactionCount || 0} transacciones financieras registradas
${moduleContext}

Módulo(s) activo(s): ${isGeneral ? "Vista general (todos los módulos)" : modules.join(", ")}

## Capacidades Especiales de Visualización

### Gráficos Interactivos
Cuando el usuario pida gráficos, dashboards, o visualizaciones de datos, genera un bloque especial con este formato EXACTO:
<!--CHART:{"type":"bar","title":"Título del gráfico","description":"Descripción breve","data":[{"name":"Ene","valor":100},{"name":"Feb","valor":200}],"xKey":"name","yKeys":[{"key":"valor","label":"Valor","color":"#7C3AED"}]}-->

Tipos disponibles: "bar", "line", "area", "pie"
- Para "pie": usa un solo yKey y el xKey para las etiquetas
- Siempre usa data real del sistema cuando esté disponible
- Si no tienes datos exactos, genera datos de ejemplo realistas basados en el contexto
- Puedes generar MÚLTIPLES gráficos en una misma respuesta
- Los colores disponibles: #7C3AED (morado), #06B6D4 (cyan), #10B981 (verde), #F59E0B (ámbar), #F43F5E (rosa), #8B5CF6 (violeta), #F97316 (naranja)

### Generación de Imágenes
Cuando el usuario pida una imagen, diagrama visual, o ilustración, genera:
<!--IMAGE:descripción detallada en inglés de la imagen a generar-->

### Tablas
Usa tablas markdown estándar cuando necesites mostrar datos tabulares:
| Columna 1 | Columna 2 |
|-----------|-----------|
| dato 1    | dato 2    |

Reglas:
- Siempre responde en español
- Sé conciso pero informativo
- Usa formato Markdown cuando sea apropiado (listas, negritas, tablas, headers)
- Si el usuario pregunta sobre datos específicos que tienes, responde con precisión
- Si no tienes información suficiente, sugiere dónde encontrarla en la plataforma
- No inventes datos que no se te hayan proporcionado (excepto para gráficos de ejemplo)
- Puedes analizar imágenes y archivos adjuntos si el usuario los envía
- Al final de cada respuesta, genera EXACTAMENTE 3 sugerencias de seguimiento relevantes en un bloque JSON especial con este formato:
<!--SUGGESTIONS-->
["sugerencia 1", "sugerencia 2", "sugerencia 3"]
<!--/SUGGESTIONS-->`;
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

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
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

  // Support both legacy single module and new modules array
  const modules: string[] = modulesRaw || (module ? [module] : ["general"]);

  if (!conversationId || !message) {
    return Response.json({ error: "Missing conversationId or message" }, { status: 400 });
  }

  // 1. Save user message to DB
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

  // 3. Build system prompt with real data
  const systemPrompt = await buildSystemPrompt(modules);

  // 4. Build full prompt
  const contextParts = history
    .slice(0, -1)
    .map(
      (msg) =>
        `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
    )
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
            // Send as SSE event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Send done event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();

        // 6. Save complete assistant response to DB
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
          updatePayload.title = await generateTitle(message);
        }

        await supabase
          .from("ai_conversations")
          .update(updatePayload)
          .eq("id", conversationId);
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errMsg })}\n\n`
          )
        );
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
