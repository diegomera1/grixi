"use server";

import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `Eres GRIXI AI, el asistente inteligente de la plataforma Grixi — una plataforma enterprise SaaS multi-tenant.

Tu rol:
- Ayudar a los usuarios con operaciones de almacén, gestión de inventario y análisis de datos
- Responder en español de manera profesional pero amigable
- Proporcionar insights sobre datos del sistema cuando se pregunte
- Sugerir optimizaciones para la gestión de almacenes
- Asistir con consultas sobre usuarios, roles y permisos

Datos del sistema actual:
- 2 organizaciones: Grixi Industrial S.A. (manufactura) y Grixi Logística S.A. (logística)
- 20 usuarios activos en el sistema
- 3 almacenes: Almacén Central (estándar), Centro Logístico (cross-docking), Cámara Fría (cold storage)
- 22 productos catalogados (materias primas, componentes electrónicos, repuestos, químicos, empaques)
- Ocupación promedio de almacenes: ~55%

Reglas:
- Siempre responde en español
- Sé conciso pero informativo
- Usa formato Markdown cuando sea apropiado (listas, negritas, etc.)
- Si no tienes información suficiente, sugiere dónde encontrarla en la plataforma
- No inventes datos específicos que no se te hayan proporcionado`;

type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function sendChatMessage(
  messages: Message[],
  userMessage: string
): Promise<{ response: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      response: "",
      error: "GEMINI_API_KEY no está configurada.",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build conversation context from recent history
    const recentHistory = messages.slice(-10);
    const contextParts = recentHistory
      .map((msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`)
      .join("\n\n");

    const fullPrompt = contextParts
      ? `${SYSTEM_PROMPT}\n\nHistorial de conversación reciente:\n${contextParts}\n\nUsuario: ${userMessage}\n\nAsistente:`
      : `${SYSTEM_PROMPT}\n\nUsuario: ${userMessage}\n\nAsistente:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: fullPrompt,
    });

    const text = response.text || "";

    return { response: text };
  } catch (error: unknown) {
    console.error("Gemini AI error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return {
      response: "",
      error: `Error al comunicarse con Gemini: ${errorMessage}`,
    };
  }
}
