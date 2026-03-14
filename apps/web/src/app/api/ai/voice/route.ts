import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { buildVoiceSystemPrompt } from "@/features/ai/voice-functions";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const currentPage = (formData.get("currentPage") as string) || "/dashboard";

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Convert audio to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    // Get user context from Supabase
    const supabase = await createClient();
    let userName = "Usuario";
    let userDepartment = "General";
    let userPosition = "Operador";

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

    // Build system prompt with context
    const systemPrompt = buildVoiceSystemPrompt({
      userName,
      userDepartment,
      userPosition,
      currentPage,
    });

    // Gather real data
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

RUTAS DE NAVEGACIÓN:
/dashboard, /command-center, /almacenes, /compras, /finanzas, /usuarios, /ai

Si el usuario pide navegar, agrega al final: [NAVEGAR:/ruta]
`;

    const client = new GoogleGenAI({ apiKey });

    // ── STEP 1: Gemini understands the audio and generates text response ──
    const sttResponse = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: audioFile.type || "audio/webm",
                data: base64Audio,
              },
            },
            {
              text: "Escucha este audio del usuario y responde en español como GRIXI, el asistente inteligente de la empresa. Responde de forma breve y natural, como si estuvieras hablando. Si el usuario pidió datos, usa los datos del sistema. Si no se entiende el audio, di 'No pude escucharte bien, ¿podrías repetir?'",
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt + "\n\n" + dataContext,
        maxOutputTokens: 300,
        temperature: 0.7,
      },
    });

    const responseText = sttResponse.text || "No pude procesar tu solicitud.";

    // Extract navigation
    const navMatch = responseText.match(/\[NAVEGAR:(\/[^\]]+)\]/);
    const cleanText = responseText.replace(/\[NAVEGAR:[^\]]+\]/g, "").trim();

    // ── STEP 2: Generate high-quality Google TTS audio ──
    let ttsAudioBase64: string | null = null;

    try {
      const ttsResponse = await client.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [
          {
            role: "user",
            parts: [{ text: cleanText }],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      });

      // Extract audio data from response
      const audioPart = ttsResponse.candidates?.[0]?.content?.parts?.[0];
      if (audioPart?.inlineData?.data) {
        ttsAudioBase64 = audioPart.inlineData.data;
      }
    } catch (ttsErr) {
      console.error("[Voice API] TTS error, falling back to browser TTS:", ttsErr);
      // Fall back to browser SpeechSynthesis on client
    }

    return NextResponse.json({
      text: cleanText,
      navigationRoute: navMatch?.[1] || null,
      audioBase64: ttsAudioBase64,
      audioMimeType: "audio/wav",
    });
  } catch (err) {
    console.error("[Voice API] Error:", err);
    return NextResponse.json(
      { error: "Error processing voice command" },
      { status: 500 }
    );
  }
}
