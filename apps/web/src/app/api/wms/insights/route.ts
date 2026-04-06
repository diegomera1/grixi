import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "GEMINI_API_KEY no configurada" },
      { status: 500 }
    );
  }

  try {
    // Direct Supabase client (no cookie/SSR overhead)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ── Fetch warehouse data in parallel ────────────────
    const [whRes, rackRes, posRes, prodRes, lotRes, soRes] = await Promise.all([
      supabase.from("warehouses").select("id, name, type, sap_plant_code").order("name"),
      supabase.from("racks").select("id, warehouse_id"),
      supabase.from("rack_positions").select("rack_id, status"),
      supabase.from("products").select("name, sku, category, valuation_price, min_stock").limit(25),
      supabase.from("lot_tracking")
        .select("lot_number, expiry_date, remaining_quantity, status, products(name, sku)")
        .eq("status", "active")
        .order("expiry_date", { ascending: true })
        .limit(10),
      supabase.from("sales_orders")
        .select("so_number, customer_name, status, total, priority")
        .in("status", ["pending", "confirmed"])
        .limit(10),
    ]);

    const warehouses = whRes.data || [];
    const racks = rackRes.data || [];
    const positions = posRes.data || [];
    const products = prodRes.data || [];
    const lots = lotRes.data || [];
    const salesOrders = soRes.data || [];

    // ── Build occupancy summary ──────────────────────────
    const racksByWh = new Map<string, string[]>();
    for (const r of racks) {
      if (!racksByWh.has(r.warehouse_id)) racksByWh.set(r.warehouse_id, []);
      racksByWh.get(r.warehouse_id)!.push(r.id);
    }
    const posByRack = new Map<string, { total: number; occupied: number }>();
    for (const p of positions) {
      if (!posByRack.has(p.rack_id)) posByRack.set(p.rack_id, { total: 0, occupied: 0 });
      const s = posByRack.get(p.rack_id)!;
      s.total++;
      if (p.status === "occupied") s.occupied++;
    }

    const whSummary = warehouses.map(w => {
      const rIds = racksByWh.get(w.id) || [];
      let t = 0, o = 0;
      for (const rId of rIds) {
        const s = posByRack.get(rId);
        if (s) { t += s.total; o += s.occupied; }
      }
      return `${w.name} (${w.sap_plant_code || "N/A"}): ${rIds.length} racks, ${o}/${t} (${t > 0 ? Math.round((o / t) * 100) : 0}%)`;
    }).join("\n");

    const now = new Date();

    // ── Build Gemini prompt context ──────────────────────
    const context = `FECHA: ${now.toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

ALMACENES:
${whSummary}

PRODUCTOS (${products.length}):
${products.map(p => `${p.name} (${p.sku}) - ${p.category} - Min: ${p.min_stock || "N/A"} - $${p.valuation_price || 0}`).join("\n")}

LOTES ACTIVOS:
${lots.map(l => {
  const prod = (l as unknown as { products: { name: string; sku: string } | null }).products;
  const days = l.expiry_date ? Math.floor((new Date(l.expiry_date).getTime() - now.getTime()) / 86400000) : null;
  return `Lote ${l.lot_number} - ${prod?.name || "?"} - ${days !== null ? `vence en ${days}d` : "sin fecha"} - Qty: ${l.remaining_quantity}`;
}).join("\n")}

PEDIDOS PENDIENTES:
${salesOrders.map(so => `${so.so_number} - ${so.customer_name} - $${so.total} - Prioridad: ${so.priority}`).join("\n")}`;

    const prompt = `Eres un analista de cadena de suministro SAP/WMS industrial. Analiza estos datos REALES de almacén y genera insights accionables de alto impacto.

${context}

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks, sin explicaciones):
{"insights":[{"insight_type":"prediction|optimization|warning|info","severity":"critical|high|medium|low","title":"máx 50 chars","message":"detalle con datos específicos del análisis"}]}

REGLAS:
- Genera exactamente 4-5 insights basados en los datos reales
- Cita nombres de productos, SKUs, porcentajes y cantidades específicas
- Al menos 1 prediction (predicción de demanda o desabasto)
- Al menos 1 optimization (optimización de espacio o procesos)
- Al menos 1 warning (alerta de vencimiento, sobrestock, etc.)
- Incluye recomendaciones accionables
- Español profesional`;

    // ── Call Gemini 3.1 Flash Lite REST API ──────────────
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("[WMS AI] Gemini HTTP error:", geminiRes.status, errBody.substring(0, 200));
      return NextResponse.json(
        { success: false, message: `Error Gemini (${geminiRes.status})` },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[WMS AI] No JSON in response:", text.substring(0, 300));
      return NextResponse.json(
        { success: false, message: "No se pudo parsear la respuesta de IA" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      insights: Array<{
        insight_type: string;
        severity: string;
        title: string;
        message: string;
      }>;
    };

    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      return NextResponse.json(
        { success: false, message: "Formato de respuesta inválido" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Insights generados por Gemini 3.1 Flash Lite",
      insights: parsed.insights.map((i, idx) => ({
        id: `ai-${Date.now()}-${idx}`,
        insight_type: i.insight_type,
        severity: i.severity,
        title: i.title,
        message: i.message,
        data: {},
        action: {},
        is_dismissed: false,
        created_at: new Date().toISOString(),
      })),
    });
  } catch (error) {
    console.error("[WMS AI API] Error:", error);
    return NextResponse.json(
      { success: false, message: `Error: ${error instanceof Error ? error.message : "Error desconocido"}` },
      { status: 500 }
    );
  }
}
