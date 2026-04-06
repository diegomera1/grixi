import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch lots with expiry context
    const { data: lots } = await supabase
      .from("lot_tracking")
      .select(`
        id, lot_number, status, expiry_date, remaining_quantity,
        products!inner(name, sku)
      `)
      .eq("org_id", DEMO_ORG_ID)
      .in("status", ["active", "expired", "quarantine"]);

    if (!lots || lots.length === 0) {
      return NextResponse.json({
        success: true,
        data: { summary: "No hay lotes registrados.", recommendations: [], urgentLots: [] },
      });
    }

    const now = Date.now();

    type LotAnalysisRow = {
      lot_number: string;
      status: string;
      expiry_date: string | null;
      remaining_quantity: number;
      products: { name: string; sku: string };
      daysToExpiry: number | null;
    };

    const analyzed: LotAnalysisRow[] = lots.map((l) => {
      const product = l.products as unknown as { name: string; sku: string };
      const days = l.expiry_date
        ? Math.ceil((new Date(l.expiry_date).getTime() - now) / 86400000)
        : null;
      return {
        lot_number: l.lot_number,
        status: l.status,
        expiry_date: l.expiry_date,
        remaining_quantity: Number(l.remaining_quantity) || 0,
        products: product,
        daysToExpiry: days,
      };
    });

    const expired = analyzed.filter((l) => l.status === "expired" || (l.daysToExpiry !== null && l.daysToExpiry <= 0));
    const expiringSoon = analyzed.filter((l) => l.daysToExpiry !== null && l.daysToExpiry > 0 && l.daysToExpiry <= 30);
    const quarantined = analyzed.filter((l) => l.status === "quarantine");

    // Build AI prompt
    const lotSummary = [
      `Total de lotes activos: ${analyzed.length}`,
      `Lotes vencidos: ${expired.length}`,
      `Lotes por vencer (≤30 días): ${expiringSoon.length}`,
      `Lotes en cuarentena: ${quarantined.length}`,
      "",
      ...expired.map((l) => `⛔ VENCIDO: ${l.products.name} (${l.lot_number}) — ${l.remaining_quantity} UN restantes`),
      ...expiringSoon.map((l) => `⚠️ POR VENCER: ${l.products.name} (${l.lot_number}) — ${l.daysToExpiry} días — ${l.remaining_quantity} UN`),
      ...quarantined.map((l) => `🔒 CUARENTENA: ${l.products.name} (${l.lot_number}) — ${l.remaining_quantity} UN`),
    ].join("\n");

    // Call Gemini for analysis
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return algorithmic analysis without AI
      const recommendations: string[] = [];
      if (expired.length > 0) {
        recommendations.push(`${expired.length} lote(s) vencido(s) requieren disposición inmediata. Priorizar revisión y posible destrucción o devolución al proveedor.`);
      }
      if (expiringSoon.length > 0) {
        recommendations.push(`${expiringSoon.length} lote(s) vencen en los próximos 30 días. Priorizar despacho FEFO para evitar pérdidas.`);
      }
      if (quarantined.length > 0) {
        recommendations.push(`${quarantined.length} lote(s) en cuarentena pendientes de revisión de calidad.`);
      }
      if (recommendations.length === 0) {
        recommendations.push("Todos los lotes están en buen estado. No se requieren acciones urgentes.");
      }

      return NextResponse.json({
        success: true,
        data: {
          summary: recommendations.join(" "),
          recommendations,
          urgentLots: [...expired, ...expiringSoon].map((l) => ({
            lot_number: l.lot_number,
            product_name: l.products.name,
            days_to_expiry: l.daysToExpiry,
            quantity: l.remaining_quantity,
            action: l.daysToExpiry !== null && l.daysToExpiry <= 0 ? "dispose" : "dispatch_fefo",
          })),
        },
      });
    }

    // Try Gemini AI analysis, fall back to algorithmic
    let aiResult: { summary: string; recommendations: string[]; risk_level?: string } | null = null;

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Eres un analista de control de calidad e inventario WMS. Analiza estos lotes y genera recomendaciones accionables en español.

DATOS DE LOTES:
${lotSummary}

Responde en JSON con esta estructura exacta (sin markdown, sin backticks):
{
  "summary": "Resumen ejecutivo de 1-2 oraciones",
  "recommendations": ["recomendación 1", "recomendación 2", "..."],
  "risk_level": "low|medium|high|critical"
}

Sé directo, conciso y prioriza las acciones más urgentes.`,
              }],
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 500,
            },
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        try {
          const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          aiResult = JSON.parse(cleaned);
        } catch {
          aiResult = {
            summary: responseText.slice(0, 200),
            recommendations: [responseText.slice(0, 300)],
            risk_level: expired.length > 0 ? "high" : expiringSoon.length > 0 ? "medium" : "low",
          };
        }
      }
    } catch {
      // Gemini failed — use algorithmic analysis below
    }

    // Fallback to algorithmic analysis
    if (!aiResult) {
      const recommendations: string[] = [];
      if (expired.length > 0) {
        recommendations.push(`${expired.length} lote(s) vencido(s) requieren disposición inmediata. Priorizar revisión y posible destrucción o devolución al proveedor.`);
      }
      if (expiringSoon.length > 0) {
        recommendations.push(`${expiringSoon.length} lote(s) vencen en los próximos 30 días. Priorizar despacho FEFO para evitar pérdidas.`);
      }
      if (quarantined.length > 0) {
        recommendations.push(`${quarantined.length} lote(s) en cuarentena pendientes de revisión de calidad.`);
      }
      if (recommendations.length === 0) {
        recommendations.push("Todos los lotes están en buen estado. No se requieren acciones urgentes.");
      }
      aiResult = {
        summary: recommendations.join(" "),
        recommendations,
        risk_level: expired.length > 0 ? "high" : expiringSoon.length > 0 ? "medium" : "low",
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        ...aiResult,
        urgentLots: [...expired, ...expiringSoon].map((l) => ({
          lot_number: l.lot_number,
          product_name: l.products.name,
          days_to_expiry: l.daysToExpiry,
          quantity: l.remaining_quantity,
          action: l.daysToExpiry !== null && l.daysToExpiry <= 0 ? "dispose" : "dispatch_fefo",
        })),
      },
    });
  } catch (err) {
    console.error("[Lot Analysis] Error:", err);
    return NextResponse.json(
      { success: false, message: "Error analyzing lots" },
      { status: 500 }
    );
  }
}
