"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { buildVoiceSystemPrompt } from "@/features/ai/voice-functions";

type VoiceContext = {
  currentPage: string;
};

export async function processVoiceCommand(
  userText: string,
  ctx: VoiceContext
): Promise<{ text: string; navigationRoute?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { text: "GEMINI_API_KEY no configurada en el servidor." };
  }

  const supabase = await createClient();

  // Get user info
  let userName = "Usuario";
  let userDepartment = "General";
  let userPosition = "Operador";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Try session fallback
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, department, position")
        .eq("id", session.user.id)
        .single();
      userName = profile?.full_name || session.user.user_metadata?.full_name || "Usuario";
      userDepartment = profile?.department || "General";
      userPosition = profile?.position || "Operador";
    }
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, department, position")
      .eq("id", user.id)
      .single();
    userName = profile?.full_name || user.user_metadata?.full_name || "Usuario";
    userDepartment = profile?.department || "General";
    userPosition = profile?.position || "Operador";
  }

  // Build system prompt
  const systemPrompt = buildVoiceSystemPrompt({
    userName,
    userDepartment,
    userPosition,
    currentPage: ctx.currentPage,
  });

  // Gather real data for context
  const [
    { count: totalProducts },
    { count: openPOs },
    { count: activeUsers },
    { data: warehouses },
    { data: incomeData },
    { data: expenseData },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("purchase_orders").select("*", { count: "exact", head: true }).not("status", "in", '("closed","cancelled")'),
    supabase.from("active_sessions").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("warehouses").select("id, name"),
    supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "income").gte("posting_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "expense").gte("posting_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const revenue = (incomeData || []).reduce((s, t) => s + Number(t.amount_usd || 0), 0);
  const expenses = (expenseData || []).reduce((s, t) => s + Math.abs(Number(t.amount_usd || 0)), 0);

  const dataContext = `
DATOS ACTUALES DEL SISTEMA:
- Productos totales: ${totalProducts || 0}
- OC abiertas: ${openPOs || 0}
- Usuarios activos: ${activeUsers || 0}
- Almacenes: ${(warehouses || []).map(w => w.name).join(", ") || "ninguno"}
- Revenue mensual: $${revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
- Gastos mensuales: $${expenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}
- Ingreso neto: $${(revenue - expenses).toLocaleString("en-US", { maximumFractionDigits: 0 })}

RUTAS DE NAVEGACIÓN DISPONIBLES:
- /dashboard → Dashboard principal
- /command-center → Centro de Comando
- /almacenes → Almacenes
- /compras → Compras
- /finanzas → Finanzas
- /usuarios → Usuarios
- /ai → GRIXI AI Chat

Si el usuario pide navegar a algún módulo, responde con el texto Y al final agrega exactamente: [NAVEGAR:/ruta]
Ejemplo: "Te llevo al dashboard. [NAVEGAR:/dashboard]"
`;

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: userText }] }],
    config: {
      systemInstruction: systemPrompt + "\n\n" + dataContext,
      maxOutputTokens: 300,
      temperature: 0.7,
    },
  });

  const responseText = response.text || "No pude procesar tu solicitud.";

  // Extract navigation command if present
  const navMatch = responseText.match(/\[NAVEGAR:(\/[^\]]+)\]/);
  const cleanText = responseText.replace(/\[NAVEGAR:[^\]]+\]/g, "").trim();

  return {
    text: cleanText,
    navigationRoute: navMatch?.[1],
  };
}
