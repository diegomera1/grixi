import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI_API_KEY not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { prompt, conversationId } = body as { prompt: string; conversationId?: string };

  if (!prompt) {
    return Response.json({ error: "Missing prompt" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Use AI image generation model
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts || [];
    let imageBase64: string | null = null;
    let mimeType = "image/png";

    for (const part of parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data || null;
        mimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageBase64) {
      return Response.json({ error: "No image generated" }, { status: 500 });
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(imageBase64, "base64");
    const fileName = `ai-generated/${user.id}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("ai-images")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, return base64 directly
      return Response.json({
        image: `data:${mimeType};base64,${imageBase64}`,
        source: "base64",
      });
    }

    const { data: urlData } = supabase.storage
      .from("ai-images")
      .getPublicUrl(fileName);

    return Response.json({
      image: urlData.publicUrl,
      source: "storage",
      conversationId,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
