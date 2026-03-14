import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

// Ephemeral token API route for secure Live API access
// The GEMINI_API_KEY never reaches the client — only the ephemeral token does
export async function POST() {
  try {
    // Verify user is authenticated
    // Note: Middleware doesn't run for /api/ routes (excluded in matcher),
    // so we use getSession() which reads existing cookies without refresh.
    const supabase = await createClient();

    // Try getUser first (preferred), fall back to getSession
    let userId: string | undefined;
    let userMeta: Record<string, string> | undefined;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      userMeta = user.user_metadata as Record<string, string>;
    } else {
      // Fallback: getSession reads from cookies directly
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        userMeta = session.user.user_metadata as Record<string, string>;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get user info for the system prompt
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, department, position")
      .eq("id", userId)
      .single();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const client = new GoogleGenAI({ apiKey });

    // Create ephemeral token locked to our model and config
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    return NextResponse.json({
      token: token.name,
      userName: profile?.full_name || userMeta?.full_name || "Usuario",
      userDepartment: profile?.department || "General",
      userPosition: profile?.position || "Operador",
    });
  } catch (error) {
    console.error("[ephemeral-token] Error:", error);
    return NextResponse.json(
      { error: "Error al generar token de voz" },
      { status: 500 }
    );
  }
}
