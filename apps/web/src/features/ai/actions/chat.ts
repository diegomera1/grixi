"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
  if (!GEMINI_API_KEY) {
    return {
      response: "",
      error: "GEMINI_API_KEY no está configurada. Agrega la variable GEMINI_API_KEY en tu archivo .env.local",
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build conversation history for context (last 5 exchanges)
    const recentHistory = messages.slice(-10);
    const history = recentHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });

    const result = await chat.sendMessage(userMessage);
    const response = result.response.text();

    return { response };
  } catch (error: unknown) {
    console.error("Gemini AI error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return {
      response: "",
      error: `Error al comunicarse con Gemini: ${errorMessage}`,
    };
  }
}
